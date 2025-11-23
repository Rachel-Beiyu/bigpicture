import React from 'react';

interface LoginPageProps {
  onLogin: () => void;
  onGuestLogin: () => void;
  isLoading: boolean;
  error?: string;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onGuestLogin, isLoading, error }) => {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* Abstract Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-200 blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-200 blur-3xl opacity-30" />
      </div>

      <div className="z-10 bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg rotate-3">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-800 mb-2">Horizon Canvas</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Your infinite spatial workspace.<br/>
          Sign in to sync your mind map to the cloud.
        </p>

        {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 w-full">
                {error}
            </div>
        )}

        <div className="w-full flex flex-col gap-3">
            <button
              onClick={onLogin}
              disabled={isLoading}
              className={`
                w-full flex items-center justify-center gap-3 px-6 py-3.5 
                border border-gray-200 rounded-xl hover:bg-gray-50 transition-all 
                shadow-sm hover:shadow-md active:scale-95 text-gray-700 font-medium
                ${isLoading ? 'opacity-70 cursor-wait' : ''}
              `}
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                 <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
              )}
              <span>{isLoading ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
            
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-300 text-xs">OR</span>
                <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <button
              onClick={onGuestLogin}
              disabled={isLoading}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium underline decoration-transparent hover:decoration-gray-300"
            >
              Continue as Guest
            </button>
        </div>

        <p className="mt-8 text-xs text-gray-400">
           Cloud sync requires Google Login. <br/> Guest data is saved locally.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;