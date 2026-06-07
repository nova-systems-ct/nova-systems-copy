// Stub — Base44 removed. Auth pages render but won't process real credentials.
export const base44 = {
  auth: {
    me: async () => null,
    loginViaEmailPassword: async () => { throw new Error('Auth not configured') },
    loginWithProvider: () => {},
    logout: () => {},
    redirectToLogin: () => {},
    requestPasswordReset: async () => {},
    resetPassword: async () => {},
    register: async () => { throw new Error('Auth not configured') },
  },
};
