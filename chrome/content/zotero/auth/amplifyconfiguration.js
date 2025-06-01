// AWS Amplify Configuration for DeepTutor Zotero Extension
export default {
  "aws_project_region": "us-west-2",
  "aws_cognito_identity_pool_id": "us-west-2:355d8a37-3249-4167-8a4f-c85e723a1dc1",
  "aws_cognito_region": "us-west-2",
  "aws_user_pools_id": "us-west-2_8anv9jMoW",
  "aws_user_pools_web_client_id": "5u6htpcfet1ths30am4tqcvtg8",
  "oauth": {
    "domain": "knowhizpool5f6ba34f-5f6ba34f-knowhizoau.auth.us-west-2.amazoncognito.com",
    "scope": [
      "phone",
      "email",
      "openid",
      "profile",
      "aws.cognito.signin.user.admin"
    ],
    "redirectSignIn": "http://localhost:3000/,https://www.knowhiz.us/,myapp://,https://staging.deeptutor.knowhiz.us/,https://deeptutor.knowhiz.us/",
    "redirectSignOut": "http://localhost:3000/,https://www.knowhiz.us/,myapp://,https://deeptutor.knowhiz.us/,https://staging.deeptutor.knowhiz.us/",
    "responseType": "code"
  },
  "federationTarget": "COGNITO_USER_POOLS",
  "aws_cognito_username_attributes": ["EMAIL"],
  "aws_cognito_social_providers": ["GOOGLE", "APPLE"],
  "aws_cognito_signup_attributes": ["EMAIL"],
  "aws_cognito_mfa_configuration": "OFF",
  "aws_cognito_mfa_types": ["SMS"],
  "aws_cognito_password_protection_settings": {
    "passwordPolicyMinLength": 8,
    "passwordPolicyCharacters": []
  },
  "aws_cognito_verification_mechanisms": ["EMAIL"]
}; 