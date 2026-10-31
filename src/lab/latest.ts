/** Tags async requests so a result that finishes after a newer request started can be discarded. */
export class Latest {
  private current = 0;

  begin(): number {
    return ++this.current;
  }

  isCurrent(token: number): boolean {
    return token === this.current;
  }
}
