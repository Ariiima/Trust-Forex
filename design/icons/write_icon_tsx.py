import os, sys
import json
d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/paths.json'))
names = sorted(d)
head = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icon_head.txt')).read()
L = [head]
L.append('export type IconName =\n' + '\n'.join(f"  | '{n}'" for n in names) + ';\n')
L.append('interface Glyph {\n  readonly d: readonly string[];\n'
         '  /** A few icons ship their stroke variant as outlined fills. */\n'
         '  readonly fill?: true;\n'
         "  /** Non-pack icons carry their own grid; defaults to the pack's. */\n"
         '  readonly box?: string;\n}\n')
L.append("/** The pack draws on a 24 grid, its first style variant offset to (16,16). */\nconst PACK_BOX = '16 16 24 24';\n")
L.append('const ICONS: Record<IconName, Glyph> = {')
for n in names:
    key = n if '-' not in n else f"'{n}'"
    g = d[n]
    ds = ', '.join(f"'{x}'" for x in g['d'])
    extra = ', fill: true' if g.get('fill') else ''
    extra += f", box: '{g['box']}'" if g.get('box') else ''
    L.append(f"  {key}: {{ d: [{ds}]{extra} }},")
L.append('};\n')
L.append('''export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Rendered box in px; the grid is always 24. */
  size?: number;
  /** Stroke width in 24-grid units. The pack draws everything at 2. */
  strokeWidth?: number;
}

export function Icon({ name, size = 24, strokeWidth = 2, ...rest }: IconProps): ReactNode {
  const g = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={g.box ?? PACK_BOX}
      fill="none"
      stroke={g.fill ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {g.d.map((d) => (
        <path key={d} d={d} fill={g.fill ? 'currentColor' : undefined} fillRule={g.fill ? 'evenodd' : undefined} />
      ))}
    </svg>
  );
}
''')
open('src/design-system/components/Icon.tsx', 'w').write('\n'.join(L))
