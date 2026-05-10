declare module "@profullstack/favicon-generator" {
  export interface IconSize {
    size: number;
    name: string;
  }

  export interface GenerateIconsOptions {
    svgPath: string;
    outputDir: string;
    iconSizes?: IconSize[];
    generateFavicon?: boolean;
    faviconSizes?: number[];
    generateRootFavicons?: boolean;
    faviconPngSize?: number;
    quality?: number;
    compressionLevel?: number;
    verbose?: boolean;
  }

  export function generateIcons(options: GenerateIconsOptions): Promise<unknown>;

  export function generateCustomIcons(
    svgPath: string,
    outputDir: string,
    customSizes: IconSize[],
    additionalOptions?: Partial<GenerateIconsOptions>,
  ): Promise<unknown>;
}
