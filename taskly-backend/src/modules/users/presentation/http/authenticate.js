export const createAuthenticate =
  ({ verifyAccessToken, cookieName }) =>
  async (req, res, next) => {
    const { userId } = await verifyAccessToken.execute({
      token: req.cookies?.[cookieName],
    });
    req.auth = { userId };
    next();
  };
