import { Amplify } from "aws-amplify";

// 環境変数から設定を取得
const cognitoConfig = {
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
  region: import.meta.env.VITE_AWS_REGION || "ap-northeast-1",
  domain: import.meta.env.VITE_COGNITO_DOMAIN || "",
  redirectSignIn:
    import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN ||
    `${window.location.origin}/callback`,
  redirectSignOut:
    import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT ||
    `${window.location.origin}/logout`,
};

// 設定値の検証とログ出力
console.log("Cognito Configuration:", {
  userPoolId: cognitoConfig.userPoolId,
  userPoolClientId: cognitoConfig.userPoolClientId,
  region: cognitoConfig.region,
  domain: cognitoConfig.domain,
  redirectSignIn: cognitoConfig.redirectSignIn,
  redirectSignOut: cognitoConfig.redirectSignOut,
});

if (!cognitoConfig.userPoolId) {
  console.error("VITE_COGNITO_USER_POOL_ID が設定されていません");
}
if (!cognitoConfig.userPoolClientId) {
  console.error("VITE_COGNITO_CLIENT_ID が設定されていません");
}
if (!cognitoConfig.domain) {
  console.error("VITE_COGNITO_DOMAIN が設定されていません");
}

// Amplify設定
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: cognitoConfig.userPoolId,
      userPoolClientId: cognitoConfig.userPoolClientId,
      loginWith: {
        oauth: {
          domain: cognitoConfig.domain,
          scopes: ["email", "openid", "profile"],
          redirectSignIn: [cognitoConfig.redirectSignIn],
          redirectSignOut: [cognitoConfig.redirectSignOut],
          responseType: "code", // Authorization code flow
        },
      },
    },
  },
});

export { cognitoConfig };
