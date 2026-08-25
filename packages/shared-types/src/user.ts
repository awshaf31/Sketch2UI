export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/** The only shape of a User ever serialized to a client — never the passwordHash. */
export interface PublicUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}
