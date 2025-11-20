import {
  associateWebAuthnCredential,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
  signOut,
} from "aws-amplify/auth";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { cognitoConfig } from "../lib/cognito";

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
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser({
        username: currentUser.username,
        userId: currentUser.userId,
        email: currentUser.signInDetails?.loginId || attributes.email,
        name: attributes.name,
        sub: attributes.sub || currentUser.userId,
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

  const handleSignInWithHostedUI = async (): Promise<void> => {
    // Cognito Hosted UIにリダイレクト（日本語表示）
    // lang=jaパラメータを追加するため手動でURLを構築
    const domain = cognitoConfig.domain;
    const clientId = cognitoConfig.userPoolClientId;
    const redirectUri = encodeURIComponent(cognitoConfig.redirectSignIn);
    const scope = encodeURIComponent("openid email profile");

    // CSRF対策用のランダムなstate値を生成
    const state = encodeURIComponent(
      Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15),
    );

    // stateをsessionStorageに保存（コールバック時に検証用）
    sessionStorage.setItem("oauth_state", state);

    const hostedUIUrl = `https://${domain}/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}&lang=ja`;

    window.location.href = hostedUIUrl;
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
