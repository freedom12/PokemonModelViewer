import { Game } from "../types";


interface PokemonModelFormResourceData {
  id: string;
  formIndex: number;
  variantIndex: number;
  icon: string;
  animations: Record<string, string[]>;
}
interface PokemonModelResourceData {
  forms: Array<PokemonModelFormResourceData>;
}

export class PokemonModel {
  private resourceDataMap: Record<string, PokemonModelResourceData> = {};

  constructor(
    public readonly index: number,
    public readonly nameId: string,
    public readonly nameJp: string,
    public readonly nameEn: string,
    public readonly nameZh: string,
    public readonly resourceId: string,
  ) {}

  get name(): string {
    // 默认使用中文名字
    return this.nameZh;
  }

  async loadResourceData(game: Game): Promise<PokemonModelResourceData> {
    if (this.resourceDataMap[game]) {
      return this.resourceDataMap[game];
    }
    console.log(`[usePokemonList] 加载宝可梦资源信息: ${this.resourceId}`);
    const data = await fetch(`/configs/${game}/pm${this.resourceId}.json`);
    if (!data.ok) {
      throw new Error(
        `加载宝可梦资源信息失败: ${this.resourceId} (HTTP ${data.status})`,
      );
    }
    this.resourceDataMap[game] = await data.json();
    return this.resourceDataMap[game];
  }

  getResourceData(game: Game): PokemonModelResourceData | null {
    return this.resourceDataMap[game] || null;
  }

  getFormResourceData(game: Game, form: [number, number]): PokemonModelFormResourceData | null {
    const resourceData = this.getResourceData(game);
    if (!resourceData) {
      return null;
    }
    const [formIndex, variantIndex] = form;
    return resourceData.forms.find(
      (f) => f.formIndex === formIndex && f.variantIndex === variantIndex,
    ) || null;
  }

  getResourceForms(game: Game): [number, number][] {
    if (!this.resourceDataMap[game]) {
      return [];
    }
    return this.resourceDataMap[game].forms.map((form) => [
      form.formIndex,
      form.variantIndex,
    ]);
  }

  getResourceFormStr(form: [number, number]): string {
    const [formIndex, variantIndex] = form;
    return `${this.resourceId}_f${formIndex
      .toString()
      .padStart(2, "0")}_${variantIndex.toString().padStart(2, "0")}`;
  }
}
