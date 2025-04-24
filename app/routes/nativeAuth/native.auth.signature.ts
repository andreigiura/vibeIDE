export class NativeAuthSignature {
  constructor(private readonly _signature: string) {}

  hex(): string {
    return this._signature;
  }
}
