import * as jwt from 'jsonwebtoken';
import jwksClient, { SigningKey } from 'jwks-rsa';
import { COMMON_CONFIG, NODE_ENV_TYPE } from 'src/config/common.config';
import { AppleJwtPayload } from 'src/modules/auth/interfaces/auth-response.interface';

const { jwksUri, issuer, clientId, algorithm } = COMMON_CONFIG.APPLE;

const IS_DEV_ENV = [NODE_ENV_TYPE.DEV, NODE_ENV_TYPE.QA].includes(
  COMMON_CONFIG.nodeEnv as string,
);

if (!jwksUri || !issuer || !clientId || !algorithm) {
  throw new Error('Apple configuration missing...');
}

const jwks = jwksClient({
  jwksUri,
  cache: true,
  rateLimit: true,
});

const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
  if (!header.kid) {
    return callback(new Error('Missing kid in token'), undefined);
  }

  jwks.getSigningKey(header.kid, (err, key: SigningKey) => {
    if (err || !key) {
      return callback(err || new Error('Signing key not found'), undefined);
    }

    callback(null, key.getPublicKey());
  });
};

export const verifyAppleToken = async (
  token: string,
): Promise<AppleJwtPayload> => {
  if (
    IS_DEV_ENV &&
    process.env.APPLE_TEST_TOKEN &&
    token === process.env.APPLE_TEST_TOKEN
  ) {
    return {
      sub: process.env.APPLE_TEST_SUB || 'test_user',
      email: process.env.APPLE_TEST_EMAIL || 'test@example.com',
      iss: issuer,
      aud: clientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: [algorithm as jwt.Algorithm],
        issuer,
        audience: clientId,
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded as AppleJwtPayload);
      },
    );
  });
};
