/**
 * 宝可梦模型加载 Composable
 *
 * 封装宝可梦特定的模型加载逻辑（formId、game 路径规则）
 */

import { ref, shallowRef } from 'vue';
import { Model, ModelLoadError } from '../core/model/Model';
import { ModelData } from '../core/data';
import { flatbuffers, TRMDL, TRMSH, TRMBF, TRMTR, TRSKL } from '../parsers';
import { getPokemonIdFromFormId } from '../utils/pokemonPath';
import { loadBinaryResource } from '../services/resourceLoader';
import type { Game } from '../core/data/types';

/**
 * 宝可梦模型加载 Composable
 */
export function usePokemonModel() {
  const model = shallowRef<Model | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  /**
   * 加载宝可梦模型
   *
   * @param formId - 形态 ID，如 'pm0001_00_00'
   * @param game - 游戏类型，'SCVI'、'LZA' 或 'LA'
   * @returns Promise<Model | null> 加载的模型实例，失败返回 null
   */
  async function loadModel(formId: string, game: Game): Promise<Model | null> {
    loading.value = true;
    error.value = null;

    // 释放旧模型
    if (model.value) {
      model.value.dispose();
      model.value = null;
    }

    const pokemonId = getPokemonIdFromFormId(formId);
    let basePath = `/${game}/${pokemonId}/${formId}/`;
    let fileBasePath = `${basePath}${formId}`;

    // LA 风格的模型文件在 mdl 子目录下
    if (game === 'LA') {
      basePath = `/${game}/${pokemonId}/${formId}/mdl/`;
      fileBasePath = `${basePath}${formId}`;
    }

    const loadFile = async (path: string): Promise<ArrayBuffer> => {
      try {
        return await loadBinaryResource(path);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('404') || msg.includes('not found')) {
          throw new ModelLoadError(`模型文件未找到: ${path}`, 'file_not_found', path);
        }
        throw new ModelLoadError(`加载文件失败: ${path} - ${msg}`, 'network_error', path);
      }
    };

    const parse = <T>(
      buffer: ArrayBuffer,
      name: string,
      getRootFn: (bb: flatbuffers.ByteBuffer) => T
    ): T => {
      const bb = new flatbuffers.ByteBuffer(new Uint8Array(buffer));
      const result = getRootFn(bb);
      if (!result) {
        throw new ModelLoadError(`${name} 文件格式错误`, 'parse_error');
      }
      return result;
    };

    try {
      // 加载必需文件
      const [trmdlBuf, trmshBuf, trmbfBuf] = await Promise.all([
        loadFile(`models${fileBasePath}.trmdl`),
        loadFile(`models${fileBasePath}.trmsh`),
        loadFile(`models${fileBasePath}.trmbf`),
      ]);

      // 解析必需文件
      const trmdl = parse(trmdlBuf, 'TRMDL', (bb) => TRMDL.getRootAsTRMDL(bb));
      const trmsh = parse(trmshBuf, 'TRMSH', (bb) => TRMSH.getRootAsTRMSH(bb));
      const trmbf = parse(trmbfBuf, 'TRMBF', (bb) => TRMBF.getRootAsTRMBF(bb));

      // 加载并解析可选文件
      let trmtr: TRMTR | undefined;
      let trskl: TRSKL | undefined;

      try {
        const buf = await loadFile(`models${fileBasePath}.trmtr`);
        trmtr = parse(buf, 'TRMTR', (bb) => TRMTR.getRootAsTRMTR(bb));
      } catch {
        /* optional */
      }

      try {
        const buf = await loadFile(`models${fileBasePath}.trskl`);
        trskl = parse(buf, 'TRSKL', (bb) => TRSKL.getRootAsTRSKL(bb));
      } catch {
        /* optional */
      }

      // 创建模型（延迟初始化模式）
      const modelData = ModelData.fromFlatBuffers(trmdl, trmsh, trmbf, trmtr, trskl);
      const newModel = new Model(modelData);
      await newModel.materialize(basePath);

      model.value = newModel;
      return model.value;
    } catch (err) {
      if (err instanceof ModelLoadError) {
        error.value = err;
      } else {
        const message = err instanceof Error ? err.message : String(err);
        error.value = new ModelLoadError(
          `加载模型失败: ${formId} - ${message}`,
          'parse_error'
        );
      }
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取宝可梦形态的可用动画列表
   *
   * @param formId - 形态 ID，如 'pm0001_00_00'
   * @param game - 游戏类型
   * @returns Promise<Record<string, string[]>> 动画名称到文件列表的映射
   */
  async function getAvailableAnimations(
    formId: string,
    game: Game
  ): Promise<Record<string, string[]>> {
    const pokemonId = getPokemonIdFromFormId(formId);

    try {
      const configResponse = await fetch(`local/configs/${game}/${pokemonId}.json`);
      if (!configResponse.ok) {
        console.warn(`[usePokemonModel] 配置文件未找到: ${pokemonId}`);
        return {};
      }

      const config = await configResponse.json();
      const form = config.forms?.find((f: any) => f.id === formId);

      return form?.animations || {};
    } catch (err) {
      console.error(`[usePokemonModel] 加载配置失败 ${formId}:`, err);
      return {};
    }
  }

  /**
   * 加载并播放动画
   *
   * @param formId - 形态 ID，如 'pm0001_00_00'
   * @param game - 游戏类型
   * @param animationName - 动画名称（键）
   * @param loop - 是否循环播放
   * @param targetModel - 可选的目标模型，如果不提供则使用内部管理的 model
   * @returns Promise<void>
   */
  async function loadAndPlayAnimation(
    formId: string,
    game: Game,
    animationName: string,
    loop: boolean = true,
    targetModel?: Model
  ): Promise<void> {
    const currentModel = targetModel || model.value;

    if (!currentModel) {
      throw new Error(`无法加载动画: 模型未加载`);
    }

    // 获取可用动画列表
    const animations = await getAvailableAnimations(formId, game);
    const animationFiles = animations[animationName];

    if (!animationFiles || animationFiles.length === 0) {
      throw new Error(`未找到动画: ${animationName}`);
    }

    // 选择第一个 .tranm 文件（骨骼动画）
    const tranmFile = animationFiles.find((file) => file.endsWith('.tranm'));
    if (!tranmFile) {
      throw new Error(`未找到骨骼动画文件 (.tranm): ${animationName}`);
    }

    // 查找对应的 .tracm 文件（可见性动画）
    const tracmFile = animationFiles.find((file) => file.endsWith('.tracm'));

    // 构建动画文件路径
    const pokemonId = getPokemonIdFromFormId(formId);
    const tranmUrl = `models/${game}/${pokemonId}/${formId}/${tranmFile}`;

    // 加载骨骼动画
    await currentModel.loadAnimationFromUrl(tranmUrl);

    // 如果有可见性动画文件，也加载它
    if (tracmFile) {
      const tracmUrl = `models/${game}/${pokemonId}/${formId}/${tracmFile}`;
      await currentModel.loadAnimationFromUrl(tracmUrl);
    }

    // 设置循环模式
    currentModel.setAnimationLoop(loop);

    // 开始播放
    currentModel.playAnimation();
  }

  /**
   * 释放当前模型
   */
  function dispose(): void {
    if (model.value) {
      model.value.dispose();
      model.value = null;
    }
  }

  return {
    model,
    loading,
    error,
    loadModel,
    getAvailableAnimations,
    loadAndPlayAnimation,
    dispose,
  };
}
