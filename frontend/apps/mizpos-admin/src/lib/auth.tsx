import {
  associateWebAuthnCredential,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
} from "aws-amplify/auth";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface User {
  username: string;
  userId: string;
  email?: string;
}

interface SignInResult {
  isSignedIn: boolean;
  nextStep?: {
    signInStep: string;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signInWithWebAuthn: (email: string) => Promise<SignInResult>;
  registerPasskey: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser({
        username: currentUser.username,
        userId: currentUser.userId,
        email: currentUser.signInDetails?.loginId,
      });
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleSignIn = async (
    email: string,
    password: string,
  ): Promise<SignInResult> => {
    const result = await signIn({ username: email, password });
    if (result.isSignedIn) {
      await checkAuth();
    }
    return {
      isSignedIn: result.isSignedIn,
      nextStep: result.nextStep
        ? {
            signInStep: result.nextStep.signInStep,
          }
        : undefined,
    };
  };

  const handleSignInWithWebAuthn = async (
    email: string,
  ): Promise<SignInResult> => {
    const result = await signIn({
      username: email,
      options: {
        authFlowType: "USER_AUTH",
        preferredChallenge: "WEB_AUTHN",
      },
    });
    if (result.isSignedIn) {
      await checkAuth();
    }
    return {
      isSignedIn: result.isSignedIn,
      nextStep: result.nextStep
        ? {
            signInStep: result.nextStep.signInStep,
          }
        : undefined,
    };
  };

  const handleRegisterPasskey = async (): Promise<void> => {
    await associateWebAuthnCredential();
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  const getAccessToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() || null;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn: handleSignIn,
        signInWithWebAuthn: handleSignInWithWebAuthn,
        registerPasskey: handleRegisterPasskey,
        signOut: handleSignOut,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
