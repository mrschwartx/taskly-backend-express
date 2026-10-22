export const createAuthCookie = ({ auth, isProduction }) => {
  const baseOptions = { httpOnly: true, path: '/' };

  const environmentOptions = isProduction
    ? {
        sameSite: 'none',
        secure: true,
        ...(auth.cookieDomain ? { domain: auth.cookieDomain } : {}),
      }
    : { sameSite: 'lax', secure: false };

  return {
    set: (res, token) =>
      res.cookie(auth.cookieName, token, {
        ...baseOptions,
        ...environmentOptions,
        maxAge: auth.cookieMaxAgeMs,
      }),
    clear: (res) =>
      res.clearCookie(auth.cookieName, {
        ...baseOptions,
        ...environmentOptions,
      }),
  };
};
