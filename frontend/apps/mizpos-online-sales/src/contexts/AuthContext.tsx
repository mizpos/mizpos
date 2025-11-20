import {
  associateWebAuthnCredential,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
  signInWithRedirect,
  signOut,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface User {
  username: string;
  userId: string;
  email?: string;
  name?: string;
  sub: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithHostedUI: () => Promise<void>;
  registerPasskey: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      console.log("Checking auth...");
      const currentUser = await getCurrentUser();
      console.log("Current user:", currentUser);
      const attributes = await fetchUserAttributes();
      console.log("User attributes:", attributes);
      setUser({
        username: currentUser.username,
        userId: currentUser.userId,
        email: currentUser.signInDetails?.loginId || attributes.email,
        name: attributes.name,
        sub: attributes.sub || currentUser.userId,
      });
      console.log("User info set successfully");
    } catch (error) {
      console.error("checkAuth error:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Hub listenerを追加して、認証完了時にユーザー情報を再取得
    const hubListener = Hub.listen("auth", (data) => {
      console.log("AuthContext Hub event:", data.payload.event);
      if (
        data.payload.event === "signedIn" ||
        data.payload.event === "signInWithRedirect"
      ) {
        console.log("User signed in, fetching user info...");
        checkAuth();
      } else if (data.payload.event === "signedOut") {
        console.log("User signed out");
        setUser(null);
      }
    });

    return () => {
      hubListener();
    };
  }, [checkAuth]);

  const handleSignInWithHostedUI = async (): Promise<void> => {
    // Amplifyの signInWithRedirect を使用
    // これによりAmplifyが認証フローを管理し、callbackでトークンを自動取得できる
    await signInWithRedirect();
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
        signInWithHostedUI: handleSignInWithHostedUI,
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
