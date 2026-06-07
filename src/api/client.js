export const authClient = {
  auth: {
    me: async () => null,
    loginViaEmailPassword: async () => { throw new Error('Auth not configured') },
    loginWithProvider: () => {},
    logout: () => {},
    redirectToLogin: () => {},
    requestPasswordReset: async () => {},
    resetPasswordRequest: async () => {},
    resetPassword: async () => {},
    register: async () => { throw new Error('Auth not configured') },
    verifyOtp: async () => { throw new Error('Auth not configured') },
    resendOtp: async () => {},
    setToken: () => {},
  },
};
