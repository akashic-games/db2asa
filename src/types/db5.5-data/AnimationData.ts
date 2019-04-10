import * as cmnData from "./CommonData";

export interface FrameData {
	// The duration of the frame. (Optional property, default: 1)
	duration?: number;

	// A list of actions. (Optional property, default: null)
	actions?: {
		// The type of the action. (Optional property, default: 0)
		// [0: Play animation, 10: Frame event, 11: Frame sound event]
		type?: number;

		// The name of the action. (The name of a animation or an event)
		name: string;

		// A bone name. (Optional property, default: null)
		bone?: string;

		// A slot name. (Optional property, default: null)
		slot?: string;

		// The list of custom data. (Optional property, default: null)
		ints?: number[];
		floats?: number[];
		strings?: string[];
	}[];
	// A list of slot indeices and numeric offsets. [slotIndexA, offsetA, slotIndexB, offsetB, ...]
	// (Optional property, default: null)
	zOrder?: number[];
}

export interface AnimationFrameData {
	// The horizontal translate of a bone in the keyframe. (Optional property, default: 0.0)
	x?: number;

	// The vertical translate of a bone in the keyframe. (Optional property, default: 0.0)
	y?: number;

	// The duration of the frame. (Optional property, default: 1)
	duration?: number;

	// The tween easing of the frame. [0.0: Linear, null: No easing]. (Optional property, default: 0)
	tweenEasing?: number;

	// The interpolation to use between this and the next keyframe. [x1, y1, x2, y2, ...]
	// (Optional property, default: null)
	curve?: number[];

	// The rotation behavior during a tween. (Optional property, default: 0)
	// [
	//     0: Chooses a direction of rotation that requires the least amount of turning,
	//     1: Rotates clockwise,
	//     -1: Rotates counterclockwise,
	//     N: Rotates clockwise at least N-rings,
	//     -N: Rotates counterclockwise at least N-rings
	// ]
	clockwise?: number[];

	// The rotation of a bone in the keyframe. [-PI ~ PI] (Optional property, default: 0.0)
	rotate?: number;

	// The skew of a bone in the keyframe. [-PI ~ PI] (Optional property, default: 0.0)
	skew?: number;

	// The display index of a slot in the keyframe. (Optional property, default: 1)
	value?: number;

	// The actions of a slot in the keyframe. (Optional property, default: null)
	actions?: cmnData.ActionData[];

	// The color transform of a slot in the frame. (Optional property, default: null)
	color?: cmnData.ColorData;

	// The number of vertices to skip before applying vertices. (Optional property, default: 0)
	offset?: number;

	// A list of number pairs that are the amounts to add to the setup vertex positions for the keyframe.
	// (Optional property, default: null)
	// [x0, y0, x1, y1, ...]
	vertices?: number[];

	// The positive direction of the IK constraint in the frame. (Optional property, default: true)
	bendPositive?: boolean;

	// The weight of the IK constraint in the frame. (Optional property, default: 1.0)
	weight?: number;

	// [key: string]: number;
}

export interface AnimationTimelineData {
	frame?: FrameData[];

	// The name of the bone.
	name: string;

	// The scale of the timeline. (Optional property, default: 0.0)
	scale?: number;

	// The offset of the timeline. (Optional property, default: 0.0)
	offset?: number;

	// A list of the translate keyframes. (Optional property, default: null)
	translateFrame?: AnimationFrameData[];

	// A list of the rotate keyframes. (Optional property, default: null)
	rotateFrame?: AnimationFrameData[];

	// A list of the scale keyframes. (Optional property, default: null)
	scaleFrame?: AnimationFrameData[];

	// A list of the display keyframes. (Optional property, default: null)
	displayFrame?: AnimationFrameData[];

	// A list of the color keyframes. (Optional property, default: null)
	colorFrame?: AnimationFrameData[];
}

export interface AnimationTimelineDataCustom extends AnimationTimelineData{
	tempFrame?: cmnData.TransformData[];
	empty?: boolean;
}

interface FfdTimelineData {
	// The name of the mesh.
	name: string;

	// The name of skin.
	skin: string;

	// The name of slot.
	slot: string;

	frame: AnimationFrameData[];
}

interface IkTimelineData {
	// The name of the IK constraint.
	name: string;

	frame: AnimationFrameData[];
}

export interface AnimationData {

	// The name of animation.
	name: string;

	// The play times of the animation. [0: Loop play, N: Play N times] (Optional property, default: 1)
	playTimes?: number;

	// The duration of the animation. (Optional property, default: 1)
	duration?: number;

	// A list of the action keyframes. (Optional property, default: null)
	frame?: FrameData[];

	// The z order timeline.
	zOrder?: AnimationTimelineData;

	// A list of the bone timelines.
	bone: AnimationTimelineData[];

	// A list of the slot timelines.
	slot: AnimationTimelineData[];

	// A list of the FFD timelines. (Optional property, default: null)
	ffd?: FfdTimelineData[];

	// A list of the IK constraint timelines. (Optional property, default: null)
	ik?: IkTimelineData[];
}
