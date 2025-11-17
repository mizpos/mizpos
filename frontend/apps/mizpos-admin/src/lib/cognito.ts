import { Amplify } from "aws-amplify";

// 環境変数から設定を取得
const cognitoConfig = {
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
  region: import.meta.env.VITE_AWS_REGION || "ap-northeast-1",
};

// 設定値の検証
if (!cognitoConfig.userPoolId) {
  console.error("VITE_COGNITO_USER_POOL_ID が設定されていません");
}
if (!cognitoConfig.userPoolClientId) {
  console.error("VITE_COGNITO_CLIENT_ID が設定されていません");
}

// Amplify設定
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: cognitoConfig.userPoolId,
      userPoolClientId: cognitoConfig.userPoolClientId,
      loginWith: {
        email: true,
      },
    },
  },
});

export { cognitoConfig };
