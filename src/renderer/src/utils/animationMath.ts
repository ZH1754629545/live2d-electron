/**
 * Live2D动画数学工具函数
 * 基于Python框架conversion的JavaScript/TypeScript实现
 */

/**
 * 线性缩放函数
 * @param value 输入值
 * @param inMin 输入最小值
 * @param inMax 输入最大值
 * @param outMin 输出最小值
 * @param outMax 输出最大值
 * @returns 缩放后的值
 */
export function linearScale1(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return outMin;
  const normalized = (value - inMin) / (inMax - inMin);
  return outMin + normalized * (outMax - outMin);
}

/**
 * 三次缓动函数 (ease-in-out cubic)
 */
export function cubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 四次缓动函数 (ease-in-out quart)
 */
export function quart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

/**
 * 正弦缓动函数 (ease-in-out sine)
 */
export function sine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * 生成指定范围内的随机数
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * 限制数值在指定范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 简化的柏林噪声实现（替代Python的noise.pnoise1）
 */
export class SimpleNoise {
  private static permutation: number[] = [];
  private static initialized = false;

  private static init() {
    if (this.initialized) return;
    
    // 生成置换表
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    
    // 随机打乱
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
    }
    
    // 复制一遍以避免边界检查
    for (let i = 0; i < 256; i++) {
      this.permutation[256 + i] = this.permutation[i];
    }
    
    this.initialized = true;
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private static lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private static grad(hash: number, x: number): number {
    const h = hash & 15;
    const grad = 1 + (h & 7);
    return (h & 8 ? -grad : grad) * x;
  }

  static noise1d(x: number): number {
    this.init();
    
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    
    const u = this.fade(x);
    
    return this.lerp(u, 
      this.grad(this.permutation[X], x),
      this.grad(this.permutation[X + 1], x - 1)
    );
  }
}

/**
 * 生成柏林噪声值（类似Python的noise.pnoise1）
 */
export function pnoise1(x: number): number {
  return SimpleNoise.noise1d(x);
}
