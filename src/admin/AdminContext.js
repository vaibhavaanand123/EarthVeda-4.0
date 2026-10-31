import { createContext, useContext } from 'react';

export const AdminContext = createContext({ user: null, onUnauthorized: () => {} });
export const useAdmin = () => useContext(AdminContext);
