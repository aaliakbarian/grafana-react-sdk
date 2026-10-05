export interface RuntimeIdentityInput {
  grafanaBasePath: string;
  locale: string;
  namespace: string;
  packages: Readonly<Record<string, string>>;
  stylePolicy: string;
}

export interface RuntimeFingerprint {
  canonicalIdentity: string;
  fingerprint: string;
  identity: RuntimeIdentityInput;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableValue(nestedValue)])
    );
  }
  return value;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createRuntimeFingerprint(identity: RuntimeIdentityInput): RuntimeFingerprint {
  const normalizedIdentity: RuntimeIdentityInput = {
    ...identity,
    packages: { ...identity.packages },
  };
  const canonicalIdentity = JSON.stringify(stableValue(normalizedIdentity));
  return {
    canonicalIdentity,
    fingerprint: `poc-runtime-v1:${fnv1a(canonicalIdentity)}:${canonicalIdentity.length}`,
    identity: normalizedIdentity,
  };
}

export interface RuntimeModuleIdentityRegistry {
  record(label: string, marker: object | Function, version: string): void;
  snapshot(): Record<string, { copies: number; labels: string[]; version: string }>;
}

export function createRuntimeIdentityRegistry(): RuntimeModuleIdentityRegistry {
  const identities = new Map<
    string,
    { labels: Set<string>; marker: object | Function; version: string }
  >();

  return {
    record(label, marker, version) {
      const moduleName = label.split(':').at(-1) ?? label;
      const existing = identities.get(moduleName);
      if (existing && existing.marker !== marker) {
        throw new Error(
          `Duplicate ${moduleName} runtime detected between ${[...existing.labels].join(', ')} and ${label}.`
        );
      }
      if (existing && existing.version !== version) {
        throw new Error(
          `${moduleName} version mismatch: ${existing.version} at ${[...existing.labels].join(', ')}; ${version} at ${label}.`
        );
      }
      if (existing) {
        existing.labels.add(label);
      } else {
        identities.set(moduleName, { labels: new Set([label]), marker, version });
      }
    },
    snapshot() {
      return Object.fromEntries(
        [...identities.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([moduleName, identity]) => [
            moduleName,
            {
              copies: 1,
              labels: [...identity.labels].sort(),
              version: identity.version,
            },
          ])
      );
    },
  };
}
