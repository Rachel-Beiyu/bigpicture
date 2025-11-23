// Type definitions for the window object to include Google APIs
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const API_KEY = process.env.API_KEY || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const FILE_NAME = 'horizon_canvas_data.json';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGoogleScripts = (onInit: () => void) => {
  const gapiLoaded = () => {
    window.gapi.load('client', async () => {
      try {
        if (API_KEY) {
          await window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
          });
        } else {
            console.warn("Google API Key is missing. GAPI initialization skipped.");
        }
      } catch (e) {
        console.error("Error initializing GAPI client", e);
      }
      // Mark as inited even if failed so App can load
      gapiInited = true;
      if (gisInited) onInit();
    });
  };

  const gisLoaded = () => {
    if (CLIENT_ID) {
        try {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                // callback is mandatory and must be a function
                callback: (resp: any) => { 
                    console.debug("Token client init callback", resp); 
                }, 
            });
        } catch (e) {
            console.error("Error initializing Google Identity Services", e);
        }
    } else {
        console.warn("Google Client ID is missing. OAuth initialization skipped.");
    }
    // Mark as inited even if failed so App can load
    gisInited = true;
    if (gapiInited) onInit();
  };

  // Check if scripts are already loaded (if navigating back)
  if (window.gapi) gapiLoaded();
  else {
    const checkGapi = setInterval(() => {
        if(window.gapi) { clearInterval(checkGapi); gapiLoaded(); }
    }, 100);
  }

  if (window.google) gisLoaded();
  else {
    const checkGis = setInterval(() => {
        if(window.google) { clearInterval(checkGis); gisLoaded(); }
    }, 100);
  }
};

export const signIn = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
        reject(new Error("Google Login is not configured (Missing Client ID)."));
        return;
    }

    // Override the callback for this specific sign-in request
    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
        return;
      }
      
      // Fetch user profile info
      try {
          if (!window.gapi.client.drive) {
             // If GAPI failed to init, we might still have a token but no API access
             console.warn("Drive API not available");
             resolve({
                accessToken: resp.access_token,
                user: { displayName: "User", photoLink: "" }
             });
             return;
          }

          const about = await window.gapi.client.drive.about.get({
              fields: "user"
          });
          
          resolve({
              accessToken: resp.access_token,
              user: about.result.user
          });
      } catch (e) {
          console.error("Error fetching user info", e);
          resolve({ accessToken: resp.access_token, user: { displayName: "User", photoLink: "" } });
      }
    };

    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const signOut = () => {
  const token = window.gapi.client.getToken();
  if (token !== null) {
    window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken('');
  }
};

export const findSaveFile = async (): Promise<{ id: string } | null> => {
  try {
    if (!window.gapi?.client?.drive) throw new Error("Drive API not loaded");
    const response = await window.gapi.client.drive.files.list({
      q: `name = '${FILE_NAME}' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      return files[0];
    }
    return null;
  } catch (err) {
    console.error('Error finding file', err);
    return null;
  }
};

export const loadDataFromDrive = async (fileId: string): Promise<any> => {
  try {
    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    });
    return response.result;
  } catch (err) {
    console.error('Error loading file', err);
    throw err;
  }
};

export const saveToDrive = async (data: any, fileId: string | null): Promise<string> => {
  if (!window.gapi?.client) throw new Error("GAPI not initialized");

  const fileContent = JSON.stringify(data);
  const metadata = {
    name: FILE_NAME,
    mimeType: 'application/json',
  };

  const multipartRequestBody =
    `\r\n--foo_bar_baz\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--foo_bar_baz\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${fileContent}\r\n` +
    `--foo_bar_baz--`;

  try {
    const method = fileId ? 'PATCH' : 'POST';
    const path = fileId 
        ? `/upload/drive/v3/files/${fileId}?uploadType=multipart` 
        : '/upload/drive/v3/files?uploadType=multipart';

    const response = await window.gapi.client.request({
      path: path,
      method: method,
      params: { uploadType: 'multipart' },
      headers: {
        'Content-Type': 'multipart/related; boundary=foo_bar_baz',
      },
      body: multipartRequestBody,
    });

    return response.result.id;
  } catch (err) {
    console.error('Error saving file', err);
    throw err;
  }
};