import { ref } from 'vue';
import { PokemonModel } from '../models';
import { Game } from '../types';

const pokemons = ref<PokemonModel[]>([]);
const pokemonResourceIdMap = ref<Record<string, PokemonModel>>({});
const formNames = ref<Record<string, string>>({});
let modelsLoaded = false;

async function loadPokemonModels(): Promise<void> {
  if (modelsLoaded) return;

  try {
    let response = await fetch('local/configs/pokemon_species.json');
    if (!response.ok) {
      throw new Error(`加载宝可梦名字失败: HTTP ${response.status}`);
    }
    let data = await response.json();
    interface PokemonSpeciesData {
      index: number;
      name: string;
      name_jp: string;
      name_en: string;
      name_zh: string;
      resource_id: string;
    }
    data.map((p: PokemonSpeciesData) => {
      const pokemonModel = new PokemonModel(
        p.index,
        p.name,
        p.name_jp,
        p.name_en,
        p.name_zh,
        p.resource_id
      );
      pokemons.value.push(pokemonModel);
      pokemonResourceIdMap.value[pokemonModel.resourceId] = pokemonModel;
    });

    response = await fetch('local/configs/pokemon_forms.json');
    if (!response.ok) {
      throw new Error(`加载形态名失败: HTTP ${response.status}`);
    }
    data = await response.json();
    formNames.value = data;
    modelsLoaded = true;
  } catch (err) {
    console.error('[PokemonBrowser] 宝可梦名字加载失败:', err);
  }
}

async function loadPokemonListInGame(game: Game): Promise<PokemonModel[]> {
  try {
    await loadPokemonModels();
    const response = await fetch(`local/configs/${game}/index.json`);
    if (!response.ok) {
      throw new Error(`加载游戏内宝可梦列表失败: HTTP ${response.status}`);
    }
    const data = await response.json();
    const pokemons: PokemonModel[] = (data.pokemonIds as string[])
      .map(
        (resourceId: string) => pokemonResourceIdMap.value[resourceId.replace('pm', '')]
      )
      .filter((p): p is PokemonModel => p !== undefined);
    pokemons.sort((a, b) => a.index - b.index);
    return pokemons;
  } catch (err) {
    console.error('[usePokemonDatas] 加载游戏内宝可梦列表失败:', err);
    return [];
  }
}

export function usePokemonDatas() {
  return {
    pokemons,
    pokemonResourceIdMap,
    formNames,
    loadPokemonModels,
    loadPokemonListInGame,
  };
}
