/**
 * Live2D动画器系统
 * 基于Python框架的JavaScript/TypeScript实现
 */

import { 
  linearScale1, 
  cubic, 
  quart, 
  sine, 
  randomFloat, 
  clamp, 
  pnoise1 
} from './animationMath';

// Live2D模型参数设置接口
export interface ParameterUpdate {
  name: string;
  value: number;
  weight: number;
}

// 动画器基础接口
export interface Animator {
  update(): ParameterUpdate[] | null;
}

// Live2D模型接口
export interface Live2DModel {
  internalModel: any;
  setParameterValue?: (paramId: string, value: number, weight?: number) => void;
}

/**
 * Live2D动画器管理器
 */
export class Live2dAnimator {
  private model: Live2DModel;
  private priorityList: Array<[number, Animator]> = [];

  constructor(model: Live2DModel) {
    this.model = model;
  }

  /**
   * 添加动画器
   * @param priority 优先级（数值越高优先级越高）
   * @param animator 动画器实例
   */
  add(priority: number, animator: Animator): void {
    let insertIndex = this.priorityList.length;
    
    for (let i = 0; i < this.priorityList.length; i++) {
      if (this.priorityList[i][0] >= priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.priorityList.splice(insertIndex, 0, [priority, animator]);
  }

  /**
   * 更新所有动画器
   */
  update(): void {
    const results: ParameterUpdate[] = [];
    
    // 从高优先级到低优先级更新
    for (let i = this.priorityList.length - 1; i >= 0; i--) {
      const result = this.priorityList[i][1].update();
      if (result === null) {
        // 删除已完成的动画器
        this.priorityList.splice(i, 1);
      } else {
        results.push(...result);
      }
    }
    
    // 应用参数更新
    for (const { name, value, weight } of results) {
      this.setModelParameter(name, value, weight);
    }
  }

  /**
   * 设置模型参数
   */
  private setModelParameter(paramId: string, value: number, weight: number = 1): void {
    try {
      const coreModel = this.model.internalModel?.coreModel;
      
      if (coreModel && coreModel._parameterIds && coreModel._parameterValues) {
        const paramIndex = coreModel._parameterIds.indexOf(paramId);
        
        if (paramIndex >= 0) {
          const oldValue = coreModel._parameterValues[paramIndex];
          const newValue = weight === 1 ? value : oldValue + (value * weight);
          coreModel._parameterValues[paramIndex] = newValue;
        }
      }
    } catch (error) {
      // 静默处理错误
    }
  }
}

/**
 * 嘴部同步动画器
 * 基于Python LipSyncHandler实现
 */
export class LipSyncAnimator implements Animator {
  private smoothingFactor: number = 0.3;
  private lastMouthValue: number = 0.0;
  private silenceThreshold: number = 0.001; // 静音阈值
  private maxRmsScale: number = 0.1; // 最大RMS缩放
  private mouthScale: number = 1.0; // 整体嘴巴开合缩放
  private currentMouthValue: number = 0.0;
  private isPlaying: boolean = false;

  /**
   * 更新嘴部同步（基于Python的update_mouth_sync方法）
   * @param audioChunk 音频数据块（Float32Array或number数组）
   */
  public updateMouthSync(audioChunk: Float32Array | number[]): void {
    this.isPlaying = true;
    
    // 计算RMS值（均方根）
    let sumSquares = 0;
    for (let i = 0; i < audioChunk.length; i++) {
      sumSquares += audioChunk[i] * audioChunk[i];
    }
    const rms = Math.sqrt(sumSquares / audioChunk.length);
    
    let mouthValue: number;
    
    // 静音检测
    if (rms < this.silenceThreshold) {
      mouthValue = 0.0;
    } else {
      // 归一化RMS值
      const normalizedRms = (rms - this.silenceThreshold) / this.maxRmsScale;
      // 使用平方函数增强效果，限制在[0,1]范围内
      mouthValue = Math.min(normalizedRms * normalizedRms, 1.0) * this.mouthScale;
    }
    
    // 平滑处理，避免嘴部动作过于突兀
    this.currentMouthValue = (this.smoothingFactor * mouthValue + 
                             (1 - this.smoothingFactor) * this.lastMouthValue);
    
    this.lastMouthValue = this.currentMouthValue;
  }
  
  /**
   * 直接设置嘴部开合值
   * @param value 嘴部开合值 (0-1)
   */
  public setMouthValue(value: number): void {
    this.isPlaying = true;
    this.currentMouthValue = clamp(value, 0, 1) * this.mouthScale;
  }
  
  /**
   * 停止嘴部动画，回到静止状态
   */
  public stopMouthSync(): void {
    this.isPlaying = false;
    this.currentMouthValue = 0.0;
    this.lastMouthValue = 0.0;
  }
  
  /**
   * 设置动画参数
   */
  public setParameters(params: {
    smoothingFactor?: number;
    silenceThreshold?: number;
    maxRmsScale?: number;
    mouthScale?: number;
  }): void {
    if (params.smoothingFactor !== undefined) this.smoothingFactor = params.smoothingFactor;
    if (params.silenceThreshold !== undefined) this.silenceThreshold = params.silenceThreshold;
    if (params.maxRmsScale !== undefined) this.maxRmsScale = params.maxRmsScale;
    if (params.mouthScale !== undefined) this.mouthScale = params.mouthScale;
  }
  
  /**
   * 获取当前状态
   */
  public getStatus(): any {
    return {
      currentMouthValue: this.currentMouthValue,
      lastMouthValue: this.lastMouthValue,
      isPlaying: this.isPlaying,
      smoothingFactor: this.smoothingFactor,
      silenceThreshold: this.silenceThreshold,
      maxRmsScale: this.maxRmsScale,
      mouthScale: this.mouthScale
    };
  }

  update(): ParameterUpdate[] {
    // 如果没有在播放，逐渐回到静止状态
    if (!this.isPlaying) {
      if (this.currentMouthValue > 0.001) {
        this.currentMouthValue = this.currentMouthValue * 0.95; // 逐渐减小
      } else {
        this.currentMouthValue = 0.0;
      }
    }
    
    return [
      { name: 'ParamMouthOpenY', value: this.currentMouthValue, weight: 1 }
    ];
  }
}

/**
 * 眨眼动画器
 */
export class BlinkAnimator implements Animator {
  private flag: number = 0;
  private interval: number = randomFloat(0.2, 0.4);
  private wait: number = 4;
  private timer: number = Date.now() / 1000;
  
  private halfCloseProbability: number = 0.4;
  private halfCloseDuration: number = randomFloat(0.8, 2.0);
  private halfCloseValue: number = randomFloat(0.3, 0.7);

  /**
   * 手动触发眨眼
   */
  public triggerBlink(): void {
    this.flag = 1;
    this.timer = Date.now() / 1000;
    this.interval = randomFloat(0.2, 0.4);
  }

  /**
   * 手动触发长时间眨眼（半闭眼状态）
   */
  public triggerLongBlink(): void {
    this.flag = 2;
    this.timer = Date.now() / 1000;
    this.halfCloseDuration = randomFloat(1.0, 2.0);
    this.halfCloseValue = randomFloat(1.0, 1.5);
  }

  update(): ParameterUpdate[] {
    const currentTime = Date.now() / 1000;
    
    if (this.flag === 1) {
      const t = Math.round((currentTime - this.timer) * 100) / 100;
      if (t > this.interval) {
        if (Math.random() < this.halfCloseProbability) {
          this.flag = 2;
          this.halfCloseDuration = randomFloat(0.8, 2.0);
          this.halfCloseValue = randomFloat(1.0, 2.0);
          this.timer = currentTime;
        } else {
          this.flag = 0;
          this.timer = currentTime;
        }
        
        this.interval = randomFloat(0.2, 0.4);
      } else {
        let eyeopen = 1 - Math.sin((t / this.interval) * Math.PI);
        eyeopen = linearScale1(eyeopen, 0, 2, 0, 2.5);
        eyeopen = Math.round(eyeopen * 100) / 100;
        
        return [
          { name: 'ParamEyeLOpen', value: eyeopen, weight: 1 },
          { name: 'ParamEyeROpen', value: eyeopen, weight: 1 }
        ];
      }
    } else if (this.flag === 2) {
      const t = currentTime - this.timer;
      if (t > this.halfCloseDuration) {
        this.flag = 0;
        this.timer = currentTime;
      } else {
        const baseValue = this.halfCloseValue;
        const breathingWave = Math.sin(t * 2) * 0.05;
        let eyeopen = baseValue + breathingWave;
        eyeopen = clamp(eyeopen, 0, 2.5);
        eyeopen = Math.round(eyeopen * 100) / 100;
        
        return [
          { name: 'ParamEyeLOpen', value: eyeopen, weight: 1 },
          { name: 'ParamEyeROpen', value: eyeopen, weight: 1 }
        ];
      }
    } else if (this.flag === 0) {
      if (currentTime - this.timer > this.wait) {
        this.flag = 1;
        this.timer = currentTime;
      }
    }
    
    return [];
  }
}

/**
 * 眼球移动动画器
 */
export class EyeBallAnimator implements Animator {
  private flag: number = 0;
  private moveDuration: number = 0.15;
  private fixationTime: number = randomFloat(1.5, 4.0);
  private microMovementTime: number = randomFloat(0.3, 0.8);
  
  public X: number = 0;
  public Y: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private startX: number = 0;
  private startY: number = 0;
  
  private timer: number = Date.now() / 1000;
  private microTimer: number = Date.now() / 1000;
  
  private microAmplitude: number = 0.05;
  private driftX: number = 0;
  private driftY: number = 0;

  private generateNaturalTarget(): void {
    const angle = randomFloat(0, 2 * Math.PI);
    
    const hRange = randomFloat(0.3, 1.0);
    const vRange = randomFloat(0.2, 0.6);
    
    this.targetX = hRange * Math.cos(angle);
    this.targetY = vRange * Math.sin(angle);
    
    this.targetX = clamp(this.targetX + randomFloat(-0.1, 0.1), -1, 1);
    this.targetY = clamp(this.targetY + randomFloat(-0.05, 0.05), -0.5, 0.5);
  }

  private addMicroMovements(): [number, number] {
    const currentTime = Date.now() / 1000;
    
    if (currentTime - this.microTimer > this.microMovementTime) {
      this.microMovementTime = randomFloat(0.2, 0.6);
      this.microTimer = currentTime;
      
      this.driftX += randomFloat(-0.02, 0.02);
      this.driftY += randomFloat(-0.01, 0.01);
      
      this.driftX = clamp(this.driftX, -this.microAmplitude, this.microAmplitude);
      this.driftY = clamp(this.driftY, -this.microAmplitude, this.microAmplitude);
    }
    
    const tremorX = Math.sin(currentTime * 30) * 0.005;
    const tremorY = Math.cos(currentTime * 25) * 0.003;
    
    return [tremorX + this.driftX, tremorY + this.driftY];
  }

  update(): ParameterUpdate[] {
    const currentTime = Date.now() / 1000;
    const elapsed = currentTime - this.timer;
    
    if (this.flag === 0) {
      if (elapsed > this.fixationTime) {
        this.flag = 2;
        this.timer = currentTime;
        this.startX = this.X;
        this.startY = this.Y;
        this.generateNaturalTarget();
        
        const distance = Math.sqrt((this.targetX - this.startX) ** 2 + (this.targetY - this.startY) ** 2);
        this.moveDuration = 0.1 + distance * 0.1;
      }
    } else if (this.flag === 2) {
      if (elapsed <= this.moveDuration) {
        const progress = elapsed / this.moveDuration;
        const easedProgress = cubic(progress);
        
        this.X = this.startX + (this.targetX - this.startX) * easedProgress;
        this.Y = this.startY + (this.targetY - this.startY) * easedProgress;
      } else {
        this.X = this.targetX;
        this.Y = this.targetY;
        this.flag = 1;
        this.timer = currentTime;
        this.fixationTime = randomFloat(1.0, 3.5);
      }
    } else if (this.flag === 1) {
      if (elapsed > this.fixationTime) {
        this.flag = 0;
        this.timer = currentTime;
        this.fixationTime = randomFloat(0.5, 1.0);
      }
    }
    
    const [microX, microY] = this.addMicroMovements();
    const finalX = this.X + microX;
    const finalY = this.Y + microY;
    
    return [
      { name: 'ParamEyeBallX', value: Math.round(finalX * 1000) / 1000, weight: 1 },
      { name: 'ParamEyeBallY', value: Math.round(finalY * 1000) / 1000, weight: 1 }
    ];
  }
}

/**
 * 头部角度动画器
 */
export class AngleAnimator implements Animator {
  private flag: number = 0;
  private interval: number = randomFloat(1.5, 3.0);
  private wait: number = randomFloat(3, 8);
  public X: number = 0;
  public Y: number = 0;
  private preX: number = 0;
  private preY: number = 0;
  private timer: number = Date.now() / 1000;
  private eyeBallAnimator: EyeBallAnimator;
  
  private noiseOffsetX: number = randomFloat(0, 1000);
  private noiseOffsetY: number = randomFloat(0, 1000);
  private microMovementScale: number = 0.02;
  
  private easingFunctions: Array<(t: number) => number> = [cubic, quart, sine];
  private currentEasing: (t: number) => number = this.easingFunctions[Math.floor(Math.random() * this.easingFunctions.length)];

  constructor(eyeBallAnimator: EyeBallAnimator) {
    this.eyeBallAnimator = eyeBallAnimator;
  }

  private addMicroMovement(baseX: number, baseY: number): [number, number] {
    const currentTime = Date.now() / 1000;
    const noiseX = pnoise1(currentTime * 0.5 + this.noiseOffsetX) * this.microMovementScale;
    const noiseY = pnoise1(currentTime * 0.5 + this.noiseOffsetY) * this.microMovementScale;
    
    return [baseX + noiseX * 30, baseY + noiseY * 30];
  }

  update(): ParameterUpdate[] {
    const currentTime = Date.now() / 1000;
    
    if (this.flag === 1) {
      const t = (currentTime - this.timer) / this.interval;
      
      if (t >= 1.0) {
        this.flag = 0;
        this.timer = currentTime;
        this.wait = randomFloat(2, 6);
        this.X += randomFloat(-0.1, 0.1);
        this.Y += randomFloat(-0.1, 0.1);
      } else {
        const easedT = this.currentEasing(t);
        
        const baseX = linearScale1(easedT, 0, 1, this.preX, this.X);
        const baseY = linearScale1(easedT, 0, 1, this.preY, this.Y);
        
        const [finalX, finalY] = this.addMicroMovement(baseX, baseY);
        
        return [
          { name: 'ParamAngleX', value: Math.round(finalX * 100) / 100, weight: 1 },
          { name: 'ParamAngleY', value: Math.round(finalY * 100) / 100, weight: 1 }
        ];
      }
    } else if (this.flag === 0) {
      if (currentTime - this.timer > this.wait) {
        this.flag = 1;
        this.timer = currentTime;
        this.interval = randomFloat(1.2, 2.8);
        this.currentEasing = this.easingFunctions[Math.floor(Math.random() * this.easingFunctions.length)];
        
        this.preX = this.X;
        this.preY = this.Y;
        
        const eyeInfluence = 0.7;
        const randomInfluence = 0.3;
        
        const targetX = (this.eyeBallAnimator.X * eyeInfluence + 
                        randomFloat(-0.3, 0.3) * randomInfluence) * 20;
        const targetY = (this.eyeBallAnimator.Y * eyeInfluence + 
                        randomFloat(-0.2, 0.2) * randomInfluence) * 20;
        
        this.X = targetX;
        this.Y = targetY;
      } else {
        const [finalX, finalY] = this.addMicroMovement(this.X, this.Y);
        return [
          { name: 'ParamAngleX', value: Math.round(finalX * 100) / 100, weight: 1 },
          { name: 'ParamAngleY', value: Math.round(finalY * 100) / 100, weight: 1 }
        ];
      }
    }
    
    return [];
  }
}

/**
 * 身体角度动画器
 */
export class BodyAngleAnimator implements Animator {
  private angleAnimator: AngleAnimator;
  
  private zAmplitude: number = 2;
  private interval: number = 4;
  private zStartTime: number = Date.now() / 1000;

  private xFollowStrength: number = randomFloat(0.3, 0.7);
  private xSmoothingFactor: number = 0.02;
  private xCurrentAngle: number = 0.0;
  private xTargetAngle: number = 0.0;
  
  private xBaseAmplitude: number = randomFloat(2.0, 5.0);
  private xBaseFrequency: number = randomFloat(0.1, 0.3);
  private xBaseOffset: number = randomFloat(0, 2 * Math.PI);

  constructor(angleAnimator: AngleAnimator) {
    this.angleAnimator = angleAnimator;
  }

  update(): ParameterUpdate[] {
    const currentTime = Date.now() / 1000;
    
    // Z轴旋转（呼吸效果）
    let zAngle = this.zAmplitude * Math.sin((currentTime - this.zStartTime) / this.interval * 2 * Math.PI);
    zAngle = Math.round(clamp(zAngle, -30.0, 30.0) * 100) / 100;

    // X轴旋转（跟随头部 + 基础摆动）
    const headXAngle = this.angleAnimator.X;
    
    const followTarget = headXAngle * this.xFollowStrength;
    
    const baseSway = this.xBaseAmplitude * Math.sin(currentTime * this.xBaseFrequency + this.xBaseOffset);
    
    this.xTargetAngle = followTarget + baseSway;
    
    this.xCurrentAngle += (this.xTargetAngle - this.xCurrentAngle) * this.xSmoothingFactor;
    
    const xAngle = Math.round(clamp(this.xCurrentAngle, -30.0, 30.0) * 100) / 100;

    return [
      { name: 'ParamBodyAngleX', value: xAngle, weight: 1 },
      { name: 'ParamBodyAngleZ', value: zAngle, weight: 1 }
    ];
  }
}

/**
 * 表情动画器
 */
export class ExpressionAnimator implements Animator {
  private _ParamEyeSmile: number = 0;
  private _ParamMouthForm: number = 0;
  private _ParamBrowLForm: number = 0;
  private _ParamBrowRForm: number = 0;
  private _ParamBrowLAngle: number = 0;
  private _ParamBrowRAngle: number = 0;

  private ParamEyeSmile: number = 0;
  private ParamMouthForm: number = 0;
  private ParamBrowLForm: number = 0;
  private ParamBrowRForm: number = 0;
  private ParamBrowLAngle: number = 0;
  private ParamBrowRAngle: number = 0;

  private interval: number = 1;
  private flag: boolean = false;
  private timer: number = 0;

  update(): ParameterUpdate[] {
    if (this.flag) {
      const t = (Date.now() / 1000 - this.timer) / this.interval;
      if (t > 1.0) {
        this.flag = false;
      } else {
        const easedT = sine(t);
        return [
          { 
            name: 'ParamEyeSmile', 
            value: Math.round(linearScale1(easedT, 0, 1, this._ParamEyeSmile, this.ParamEyeSmile) * 100) / 100, 
            weight: 1 
          },
          { 
            name: 'ParamMouthForm', 
            value: Math.round(linearScale1(easedT, 0, 1, this._ParamMouthForm, this.ParamMouthForm) * 100) / 100, 
            weight: 1 
          },
          { 
            name: 'ParamBrowLForm', 
            value: Math.round(linearScale1(easedT, 0, 1, this._ParamBrowLForm, this.ParamBrowLForm) * 100) / 100, 
            weight: 1 
          },
          { 
            name: 'ParamBrowRForm', 
            value: Math.round(linearScale1(easedT, 0, 1, this._ParamBrowRForm, this.ParamBrowRForm) * 100) / 100, 
            weight: 1 
          },
          { 
            name: 'ParamBrowLAngle', 
            value: Math.round(linearScale1(easedT, 0, 1, this._ParamBrowLAngle, this.ParamBrowLAngle) * 100) / 100, 
            weight: 1 
          },
          { 
            name: 'ParamBrowRAngle', 
            value: Math.round(linearScale1(easedT, 0, 1, this._ParamBrowRAngle, this.ParamBrowRAngle) * 100) / 100, 
            weight: 1 
          }
        ];
      }
    }

    return [];
  }

  /**
   * 开始表情动画
   * @param happy 快乐程度 (0-10)
   */
  start(happy: number): void {
    this._ParamEyeSmile = this.ParamEyeSmile;
    this._ParamMouthForm = this.ParamMouthForm;
    this._ParamBrowLForm = this.ParamBrowLForm;
    this._ParamBrowRForm = this.ParamBrowRForm;
    this._ParamBrowLAngle = this.ParamBrowLAngle;
    this._ParamBrowRAngle = this.ParamBrowRAngle;

    this.ParamEyeSmile = linearScale1(happy, 0, 10, 0, 1);
    this.ParamMouthForm = linearScale1(happy, 0, 10, -1, 1);
    this.ParamBrowLForm = linearScale1(happy, 0, 10, -1, 1);
    this.ParamBrowRForm = linearScale1(happy, 0, 10, -1, 1);
    this.ParamBrowLAngle = linearScale1(happy, 0, 10, 0, 1);
    this.ParamBrowRAngle = linearScale1(happy, 0, 10, 0, 1);

    this.timer = Date.now() / 1000;
    this.flag = true;
  }
}

/**
 * 从文本中解析表情命令
 * @param text 包含表情命令的文本
 * @param expressionAnimator 表情动画器实例
 */
export function updateExpression(text: string, expressionAnimator: ExpressionAnimator): void {
  const matches = text.match(/\{[^}]*\}/g);
  if (!matches) return;
  
  for (const match of matches) {
    try {
      const jsonData = JSON.parse(match);
      if ('happy' in jsonData) {
        const happy = jsonData.happy;
        expressionAnimator.start(happy);
      }
    } catch (error) {
      console.warn('表情命令解析失败:', match, error);
    }
  }
}
