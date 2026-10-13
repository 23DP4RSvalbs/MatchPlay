import { createContext, useContext } from 'react';
export type Notify = (message: string, kind?: 'success' | 'error') => void;
export const ToastContext = createContext<Notify>(() => {});
export const useToast = () => useContext(ToastContext);
