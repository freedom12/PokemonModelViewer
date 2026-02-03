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
  async function load(formId: string, game: Game): Promise<Model | null> {
    loading.value = true;
    error.value = null;

    // 释放旧模型
    if (model.value) {
      model.value.dispose();
      model.value = null;
    }

    const pokemonId = getPokemonIdFromFormId(formId);
    // LA 风格的模型文件在 mdl 子目录下
    const modelSubPath = game === 'LA' ? '/mdl' : '';
    const fileBasePath = `/${game}/${pokemonId}/${formId}${modelSubPath}/${formId}`;
    const basePath = `/${game}/${pokemonId}/${formId}${modelSubPath}/`;

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
        loadFile(`${fileBasePath}.trmdl`),
        loadFile(`${fileBasePath}.trmsh`),
        loadFile(`${fileBasePath}.trmbf`),
      ]);

      // 解析必需文件
      const trmdl = parse(trmdlBuf, 'TRMDL', (bb) => TRMDL.getRootAsTRMDL(bb));
      const trmsh = parse(trmshBuf, 'TRMSH', (bb) => TRMSH.getRootAsTRMSH(bb));
      const trmbf = parse(trmbfBuf, 'TRMBF', (bb) => TRMBF.getRootAsTRMBF(bb));

      // 加载并解析可选文件
      let trmtr: TRMTR | undefined;
      let trskl: TRSKL | undefined;

      try {
        const buf = await loadFile(`${fileBasePath}.trmtr`);
        trmtr = parse(buf, 'TRMTR', (bb) => TRMTR.getRootAsTRMTR(bb));
      } catch {
        /* optional */
      }

      try {
        const buf = await loadFile(`${fileBasePath}.trskl`);
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
    load,
    dispose,
  };
}
