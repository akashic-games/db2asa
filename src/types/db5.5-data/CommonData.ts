export const enum ActionType {
	Play = 0,
	Stop = 1,
	GotoAndPlay = 2,
	GotoAndStop = 3,
	FadeIn = 4,
	FadeOut = 5,
}

export interface ColorData {
	aM?: number; // The alpha multiplier. [0~100] (Optional property, default: 100)
	rM?: number; // The red multiplier. [0~100] (Optional property, default: 100)
	gM?: number; // The green multiplier. [0~100] (Optional property, default: 100)
	bM?: number; // The blue multiplier. [0~100] (Optional property, default: 100)
	aO?: number; // The alpha offset. [-255~255] (Optional property, default: 0)
	rO?: number; // The red offset. [-255~255] (Optional property, default: 0)
	gO?: number; // The green offset. [-255~255] (Optional property, default: 0)
	bO?: number; // The blue offset. [-255~255] (Optional property, default: 0)
}

export interface TransformData {
	x?: number;   // The horizontal translate. (Optional property, default: 0.0)
	y?: number;   // The vertical translate. (Optional property, default: 0.0)
	skX?: number; // The horizontal skew. (Optional property, default: 0.0)
	skY?: number; // The vertical skew. (Optional property, default: 0.0)
	scX?: number; // The horizontal scale. (Optional property, default: 1.0)
	scY?: number; // The vertical scale. (Optional property, default: 1.0)
	[key: string]: number;
}

export interface ActionData {
	gotoAndPlay: string;
}

export interface Rectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}
