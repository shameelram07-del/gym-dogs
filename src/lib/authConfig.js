export const msalConfig = {
  auth: {
    clientId: 'ae9c5e5e-61dd-4500-b71f-4a5fa48ed0a7',
    authority: 'https://gymdogs.ciamlogin.com/',
    redirectUri: typeof window !== 'undefined' ? window.location.origin + '/dashboard' : 'http://localhost:3000/dashboard',
    postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin + '/login' : 'http://localhost:3000/login',
  },
  cache: {
    // localStorage (not sessionStorage) so the login survives the iOS PWA
    // closing/backgrounding — sessionStorage gets wiped and logs the user out.
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true,
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};