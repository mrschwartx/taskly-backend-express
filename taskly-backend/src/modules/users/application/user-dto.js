export const toUserDto = (user) => ({
  _id: user.id,
  username: user.username.value,
  email: user.email.value,
  avatar: user.avatar,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
