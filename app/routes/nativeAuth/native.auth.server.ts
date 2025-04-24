import { Address, LibraryConfig, Message, MessageComputer } from '@multiversx/sdk-core';
import axios, { HttpStatusCode } from 'axios';
import * as crypto from 'crypto';
import { NativeAuthInvalidBlockHashError } from './entities/errors/native.auth.invalid.block.hash.error';
import { NativeAuthInvalidConfigError } from './entities/errors/native.auth.invalid.config.error';
import { NativeAuthInvalidImpersonateError } from './entities/errors/native.auth.invalid.impersonate.error';
import { NativeAuthInvalidSignatureError } from './entities/errors/native.auth.invalid.signature.error';
import { NativeAuthInvalidTokenError } from './entities/errors/native.auth.invalid.token.error';
import { NativeAuthInvalidTokenTtlError } from './entities/errors/native.auth.invalid.token.ttl.error';
import { NativeAuthInvalidWildcardOriginError } from './entities/errors/native.auth.invalid.wildcard.origin.error';
import { NativeAuthOriginNotAcceptedError } from './entities/errors/native.auth.origin.not.accepted.error';
import { NativeAuthTokenExpiredError } from './entities/errors/native.auth.token.expired.error';
import { NativeAuthDecoded } from './entities/native.auth.decoded';
import { NativeAuthServerConfig } from './entities/native.auth.server.config';
import { NativeAuthResult as NativeAuthValidateResult } from './entities/native.auth.validate.result';
import { WildcardOrigin } from './entities/wildcard.origin';

export class NativeAuthServer {
  private _defaultApiUrl = 'https://api.multiversx.com';
  private _maxExpirySeconds = 86400 * 1000;
  private _oneHour = 3600;

  private readonly _acceptedWildcardOrigins = new Set<string>();

  private readonly _wildcardOrigins: WildcardOrigin[] = [];

  constructor(readonly config: NativeAuthServerConfig) {
    LibraryConfig.DefaultAddressHrp = 'vibe';

    if (!config.apiUrl) {
      config.apiUrl = this._defaultApiUrl;
    }

    if (!(config.maxExpirySeconds > 0 && config.maxExpirySeconds <= this._maxExpirySeconds)) {
      throw new NativeAuthInvalidConfigError(
        `maxExpirySeconds must be greater than 0 and cannot be greater than ${this._maxExpirySeconds}`,
      );
    }

    if (!Array.isArray(config.acceptedOrigins)) {
      throw new NativeAuthInvalidConfigError('acceptedOrigins must be an array');
    }

    if (!config.acceptedOrigins || config.acceptedOrigins.length === 0) {
      throw new NativeAuthInvalidConfigError('at least one value must be specified in the acceptedOrigins array');
    }

    this._wildcardOrigins = this._getWildcardOrigins();
  }

  /** decodes the accessToken in its components: ttl, origin, address, signature, blockHash & body */
  decode(accessToken: string): NativeAuthDecoded {
    const tokenComponents = accessToken.split('.');

    if (tokenComponents.length !== 3) {
      throw new NativeAuthInvalidTokenError();
    }

    const [address, body, signature] = accessToken.split('.');
    const parsedAddress = this._decodeValue(address);
    const parsedBody = this._decodeValue(body);
    const bodyComponents = parsedBody.split('.');

    if (bodyComponents.length !== 4) {
      throw new NativeAuthInvalidTokenError();
    }

    const [origin, blockHash, ttl, extraInfo] = bodyComponents;

    let parsedExtraInfo;

    try {
      parsedExtraInfo = JSON.parse(this._decodeValue(extraInfo));
    } catch {
      throw new NativeAuthInvalidTokenError();
    }

    const parsedOrigin = this._decodeValue(origin);

    const result = new NativeAuthDecoded({
      ttl: Number(ttl),
      origin: parsedOrigin,
      address: parsedAddress,
      extraInfo: parsedExtraInfo,
      signature,
      blockHash,
      body: parsedBody,
    });

    // if empty object, delete extraInfo ('e30' = encoded '{}')
    if (extraInfo === 'e30') {
      delete result.extraInfo;
    }

    return result;
  }

  /**
   * decodes and validates the accessToken.
   *
   * Performs validation of the block hash, verifies its validity, as well as origin verification
   */
  async validate(accessToken: string): Promise<NativeAuthValidateResult> {
    const decoded = this.decode(accessToken);
    const decodedTtl = decoded.ttl * 1000;

    if (decodedTtl > this.config.maxExpirySeconds * 1000) {
      throw new NativeAuthInvalidTokenTtlError(decodedTtl, this.config.maxExpirySeconds);
    }

    const isAccepted = await this._isOriginAccepted(decoded.origin);

    if (!isAccepted) {
      throw new NativeAuthOriginNotAcceptedError();
    }

    const blockTimestamp = await this._getBlockTimestamp(decoded.blockHash);

    console.log('blockTimestamp', blockTimestamp);

    if (!blockTimestamp) {
      throw new NativeAuthInvalidBlockHashError();
    }

    const currentBlockTimestamp = await this._getCurrentBlockTimestamp();

    console.log('currentBlockTimestamp', currentBlockTimestamp);

    const expires = blockTimestamp + decodedTtl;

    console.log('decoded.ttl', decodedTtl);
    console.log('expires', expires);

    const isTokenExpired = expires < currentBlockTimestamp;

    console.log('isTokenExpired', isTokenExpired);

    if (isTokenExpired) {
      throw new NativeAuthTokenExpiredError();
    }

    const address = new Address(decoded.address);
    const signatureBuffer = Buffer.from(decoded.signature, 'hex');

    const signedMessage = `${decoded.address}${decoded.body}`;
    let valid = await this._verifySignature(address, signedMessage, signatureBuffer);

    if (!valid && !this.config.skipLegacyValidation) {
      const signedMessageLegacy = `${decoded.address}${decoded.body}{}`;
      valid = await this._verifySignature(address, signedMessageLegacy, signatureBuffer);
    }

    if (!valid) {
      throw new NativeAuthInvalidSignatureError();
    }

    const impersonateAddress = await this._validateImpersonateAddress(decoded);

    const result = new NativeAuthValidateResult({
      issued: blockTimestamp,
      expires,
      origin: decoded.origin,
      address: impersonateAddress ?? decoded.address,
      extraInfo: decoded.extraInfo,
      signerAddress: decoded.address,
    });

    if (!decoded.extraInfo) {
      delete result.extraInfo;
    }

    return result;
  }

  private async _validateImpersonateAddress(decoded: NativeAuthDecoded): Promise<string | undefined> {
    const impersonateAddress = decoded.extraInfo?.multisig ?? decoded.extraInfo?.impersonate;

    if (!impersonateAddress) {
      return undefined;
    }

    if (this.config.validateImpersonateCallback) {
      const isValid = await this.config.validateImpersonateCallback(decoded.address, impersonateAddress);

      if (isValid) {
        return impersonateAddress;
      }
    }

    if (this.config.validateImpersonateUrl) {
      const isValid = await this._validateImpersonateAddressFromUrl(decoded.address, impersonateAddress);

      if (isValid) {
        return impersonateAddress;
      }
    }

    throw new NativeAuthInvalidImpersonateError();
  }

  private async _validateImpersonateAddressFromUrl(
    address: string,
    impersonateAddress: string,
  ): Promise<string | undefined> {
    const cacheKey = `impersonate:${address}:${impersonateAddress}`;

    if (this.config.cache) {
      const cachedValue = await this.config.cache.getValue(cacheKey);

      if (cachedValue === 1) {
        return impersonateAddress;
      }
    }

    const url = `${this.config.validateImpersonateUrl}/${address}/${impersonateAddress}`;

    try {
      await axios.get(url);

      if (this.config.cache) {
        await this.config.cache.setValue(cacheKey, 1, this._oneHour);
      }

      return impersonateAddress;
    } catch (error) {
      // if the error is forbidden, we can cache the result
      if (axios.isAxiosError(error) && error.response?.status === HttpStatusCode.Forbidden) {
        if (this.config.cache) {
          await this.config.cache.setValue(cacheKey, 0, this._oneHour);
        }

        throw new NativeAuthInvalidImpersonateError();
      }

      throw error;
    }
  }

  private async _verifySignature(address: Address, message: string, signature: Buffer): Promise<boolean> {
    if (this.config.verifySignature) {
      return await this.config.verifySignature(address.toBech32(), message, signature);
    }

    const cryptoPublicKey = crypto.createPublicKey({
      format: 'der',
      type: 'spki',
      key: this._toDER(address.getPublicKey()),
    });

    const signableMessage = new Message({
      address,
      data: Buffer.from(message, 'utf8'),
    });

    const cryptoMessage = new MessageComputer().computeBytesForSigning(signableMessage);

    return crypto.verify(null, cryptoMessage, cryptoPublicKey, signature);
  }

  private async _get(url: string): Promise<any> {
    const response = await axios.get(url, {
      headers: this.config.extraRequestHeaders,
    });
    return response.data;
  }

  private async _getCurrentBlockTimestamp(): Promise<number> {
    if (this.config.cache) {
      const timestamp = await this.config.cache.getValue('block:timestamp:latest');

      if (timestamp) {
        return timestamp;
      }
    }

    const response = await this._get(`${this.config.apiUrl}/blocks?size=1&fields=timestamp`);
    const timestamp = Number(response[0].timestamp);

    if (this.config.cache) {
      await this.config.cache.setValue('block:timestamp:latest', timestamp, 6);
    }

    return timestamp;
  }

  private async _getBlockTimestamp(hash: string): Promise<number | undefined> {
    if (this.config.cache) {
      const timestamp = await this.config.cache.getValue(`block:timestamp:${hash}`);

      if (timestamp) {
        return timestamp;
      }
    }

    try {
      const timestamp = await this._get(`${this.config.apiUrl}/blocks/${hash}?extract=timestamp`);

      if (this.config.cache) {
        await this.config.cache.setValue(`block:timestamp:${hash}`, Number(timestamp), this.config.maxExpirySeconds);
      }

      return Number(timestamp);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return undefined;
        }
      }

      throw error;
    }
  }

  private _decodeValue(str: string) {
    return Buffer.from(this._unescape(str), 'base64').toString('utf8');
  }

  private _unescape(str: string) {
    return str.replace(/-/g, '+').replace(/_/g, '/');
  }

  private _toDER(key: Buffer) {
    // Ed25519's OID
    const oid = Buffer.from([0x06, 0x03, 0x2b, 0x65, 0x70]);

    // Create a byte sequence containing the OID and key
    const elements = Buffer.concat([
      Buffer.concat([
        Buffer.from([0x30]), // Sequence tag
        Buffer.from([oid.length]),
        oid,
      ]),
      Buffer.concat([
        Buffer.from([0x03]), // Bit tag
        Buffer.from([key.length + 1]),
        Buffer.from([0x00]), // Zero bit
        key,
      ]),
    ]);

    // Wrap up by creating a sequence of elements
    const der = Buffer.concat([
      Buffer.from([0x30]), // Sequence tag
      Buffer.from([elements.length]),
      elements,
    ]);

    return der;
  }

  private async _isOriginAccepted(origin: string): Promise<boolean> {
    console.log('origin', origin);
    console.log(this.config.acceptedOrigins);

    if (this._isWildcardOriginAccepted(origin)) {
      return true;
    }

    const isAccepted =
      this.config.acceptedOrigins.includes(origin) || this.config.acceptedOrigins.includes('https://' + origin);

    if (isAccepted) {
      return true;
    }

    if (this.config.isOriginAccepted) {
      return await this.config.isOriginAccepted(origin);
    }

    return false;
  }

  private _isWildcardOriginAccepted(origin: string): boolean {
    if (this._acceptedWildcardOrigins.has(origin)) {
      return true;
    }

    if (this._wildcardOrigins.length === 0) {
      return false;
    }

    const wildcardOrigin = this._wildcardOrigins.find(
      (o) => origin.startsWith(o.protocol) && origin.endsWith(o.domain),
    );

    if (!wildcardOrigin) {
      return false;
    }

    this._acceptedWildcardOrigins.add(origin);

    if (this._acceptedWildcardOrigins.size > 1000) {
      const firstKey = this._acceptedWildcardOrigins.keys().next().value;

      if (firstKey) {
        this._acceptedWildcardOrigins.delete(firstKey);
      }
    }

    return true;
  }

  private _getWildcardOrigins(): WildcardOrigin[] {
    const originsWithWildcard = this.config.acceptedOrigins.filter((o) => o.includes('*'));

    if (originsWithWildcard.length === 0) {
      return [];
    }

    /*
     * protocol is what comes before the first '*'
     * domain is what comes after the first '*' and before the first slash
     */
    const wildcardOrigins: WildcardOrigin[] = [];

    for (const origin of originsWithWildcard) {
      const components = origin.split('*');

      if (components.length !== 2) {
        throw new NativeAuthInvalidWildcardOriginError();
      }

      const [protocol, domain] = components;

      if (protocol !== '' && !['https://', 'http://'].includes(protocol)) {
        throw new NativeAuthInvalidWildcardOriginError();
      }

      wildcardOrigins.push(new WildcardOrigin({ protocol, domain }));
    }

    return wildcardOrigins;
  }
}
