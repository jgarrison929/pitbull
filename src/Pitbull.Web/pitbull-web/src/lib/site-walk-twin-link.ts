/** Site walk → twin link visibility (2.14.7). Hidden when digitalTwin feature flag is off. */
export function shouldShowSiteWalkTwinLink(flagEnabled: boolean): boolean {
  return flagEnabled === true;
}
