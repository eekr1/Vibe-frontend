import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState
} from "react";
import { apiRequest } from "../lib/api";

export type CurrentUser = {
  accountState: "active" | "restricted" | "suspended" | "banned";
  avatarUrl: string | null;
  displayName: string;
  email: string;
  id: string;
  role: "member" | "admin";
  username: string;
};

type LoginInput = {
  emailOrUsername: string;
  password: string;
};

type SignupInput = {
  displayName: string;
  email: string;
  password: string;
  username: string;
};

type AuthContextValue = {
  currentUser: CurrentUser | null;
  isCheckingSession: boolean;
  login: (input: LoginInput) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  signup: (input: SignupInput) => Promise<CurrentUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  async function refreshCurrentUser() {
    try {
      const data = await apiRequest<{ user: CurrentUser }>("/auth/me");
      setCurrentUser(data.user);
    } catch {
      setCurrentUser(null);
    } finally {
      setIsCheckingSession(false);
    }
  }

  async function login(input: LoginInput) {
    const data = await apiRequest<{ user: CurrentUser }>("/auth/login", {
      body: input,
      method: "POST"
    });
    setCurrentUser(data.user);
    return data.user;
  }

  async function signup(input: SignupInput) {
    const data = await apiRequest<{ user: CurrentUser }>("/auth/signup", {
      body: input,
      method: "POST"
    });
    setCurrentUser(data.user);
    return data.user;
  }

  async function logout() {
    await apiRequest<{ loggedOut: boolean }>("/auth/logout", {
      method: "POST"
    });
    setCurrentUser(null);
  }

  useEffect(() => {
    void refreshCurrentUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isCheckingSession,
        login,
        logout,
        refreshCurrentUser,
        signup
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
