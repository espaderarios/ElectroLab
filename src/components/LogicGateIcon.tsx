import React from "react";

export type LogicGateType =
  | "AND"
  | "OR"
  | "NOT"
  | "NAND"
  | "NOR"
  | "XOR"
  | "XNOR";

export interface LogicGateIconProps {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showPins?: boolean;
  showLabels?: boolean;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_COLOR = "#2563eb";

const VB_WIDTH = 180;
const VB_HEIGHT = 120;

const INPUT_X = 12;
const GATE_LEFT = 48;
const GATE_RIGHT = 138;
const OUTPUT_X = 168;

const INPUT_Y_TOP = 42;
const INPUT_Y_BOTTOM = 78;
const OUTPUT_Y = 60;

/* -------------------------------------------------------------------------- */
/*                              SHARED HELPERS                                */
/* -------------------------------------------------------------------------- */

interface GateBaseProps extends LogicGateIconProps {
  children: React.ReactNode;
  gateClassName?: string;
}

function GateBase({
  size = 100,
  width,
  height,
  color = DEFAULT_COLOR,
  strokeWidth = 4,
  showPins = true,
  showLabels = false,
  className = "",
  children,
  gateClassName = "",
}: GateBaseProps) {
  const finalWidth = width ?? size;
  const finalHeight = height ?? size * (VB_HEIGHT / VB_WIDTH);

  return (
    <svg
      width={finalWidth}
      height={finalHeight}
      viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Logic gate"
      style={{
        color,
        overflow: "visible",
      }}
    >
      {/* Gate body */}
      <g
        className={gateClassName}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>

      {/* Input / output pins */}
      {showPins && (
        <g
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        >
          {/* Input 1 */}
          <line
            x1={INPUT_X}
            y1={INPUT_Y_TOP}
            x2={GATE_LEFT}
            y2={INPUT_Y_TOP}
          />

          {/* Input 2 */}
          <line
            x1={INPUT_X}
            y1={INPUT_Y_BOTTOM}
            x2={GATE_LEFT}
            y2={INPUT_Y_BOTTOM}
          />

          {/* Output */}
          <line
            x1={GATE_RIGHT}
            y1={OUTPUT_Y}
            x2={OUTPUT_X}
            y2={OUTPUT_Y}
          />
        </g>
      )}

      {showLabels && (
        <g
          fill="currentColor"
          fontFamily="monospace"
          fontSize="11"
          fontWeight="600"
        >
          <text x="3" y="34">
            A
          </text>

          <text x="3" y="94">
            B
          </text>

          <text x="154" y="50">
            Y
          </text>
        </g>
      )}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                                AND GATE                                    */
/* -------------------------------------------------------------------------- */

export function AndGateIcon(props: LogicGateIconProps) {
  return (
    <GateBase {...props}>
      <path
        d="
          M48 24
          H91
          C116 24 138 39 138 60
          C138 81 116 96 91 96
          H48
          Z
        "
      />
    </GateBase>
  );
}

/* -------------------------------------------------------------------------- */
/*                                OR GATE                                     */
/* -------------------------------------------------------------------------- */

export function OrGateIcon(props: LogicGateIconProps) {
  return (
    <GateBase {...props}>
      <path
        d="
          M48 24
          C65 27 76 35 88 41
          C101 48 116 54 138 60
          C116 66 101 72 88 79
          C76 85 65 93 48 96
          C58 82 63 72 63 60
          C63 48 58 38 48 24
          Z
        "
      />
    </GateBase>
  );
}

/* -------------------------------------------------------------------------- */
/*                                NOT GATE                                    */
/* -------------------------------------------------------------------------- */

export function NotGateIcon(props: LogicGateIconProps) {
  const {
    size = 100,
    width,
    height,
    color = DEFAULT_COLOR,
    strokeWidth = 4,
    showPins = true,
    showLabels = false,
    className = "",
  } = props;

  const finalWidth = width ?? size;
  const finalHeight = height ?? size * (VB_HEIGHT / VB_WIDTH);

  return (
    <svg
      width={finalWidth}
      height={finalHeight}
      viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ color, overflow: "visible" }}
      role="img"
      aria-label="NOT gate"
    >
      <g
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Input */}
        {showPins && (
          <line
            x1={INPUT_X}
            y1={OUTPUT_Y}
            x2={GATE_LEFT}
            y2={OUTPUT_Y}
          />
        )}

        {/* Triangle */}
        <path d="M48 27 L48 93 L128 60 Z" />

        {/* Output wire */}
        {showPins && (
          <line
            x1="137"
            y1="60"
            x2={OUTPUT_X}
            y2="60"
          />
        )}

        {/* NOT inversion bubble */}
        <circle
          cx="132"
          cy="60"
          r="5"
          fill="white"
        />
      </g>

      {showLabels && (
        <g
          fill="currentColor"
          fontFamily="monospace"
          fontSize="11"
          fontWeight="600"
        >
          <text x="3" y="50">
            A
          </text>

          <text x="154" y="50">
            Y
          </text>
        </g>
      )}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                               NAND GATE                                    */
/* -------------------------------------------------------------------------- */

export function NandGateIcon(props: LogicGateIconProps) {
  return (
    <GateBase {...props}>
      {/* AND body */}
      <path
        d="
          M48 24
          H87
          C110 24 128 39 128 60
          C128 81 110 96 87 96
          H48
          Z
        "
      />

      {/* Inversion bubble */}
      <circle
        cx="134"
        cy="60"
        r="6"
        fill="white"
      />

      {/* Output extension */}
      <line x1="140" y1="60" x2="168" y2="60" />
    </GateBase>
  );
}

/* -------------------------------------------------------------------------- */
/*                                NOR GATE                                    */
/* -------------------------------------------------------------------------- */

export function NorGateIcon(props: LogicGateIconProps) {
  return (
    <GateBase {...props}>
      {/* OR body */}
      <path
        d="
          M48 24
          C64 27 76 35 88 41
          C101 48 112 54 128 60
          C112 66 101 72 88 79
          C76 85 64 93 48 96
          C58 82 63 72 63 60
          C63 48 58 38 48 24
          Z
        "
      />

      {/* Inversion bubble */}
      <circle
        cx="134"
        cy="60"
        r="6"
        fill="white"
      />

      {/* Output extension */}
      <line x1="140" y1="60" x2="168" y2="60" />
    </GateBase>
  );
}

/* -------------------------------------------------------------------------- */
/*                                XOR GATE                                    */
/* -------------------------------------------------------------------------- */

export function XorGateIcon(props: LogicGateIconProps) {
  return (
    <GateBase {...props}>
      {/* Extra XOR curved input line */}
      <path
        d="
          M39 24
          C50 38 55 48 55 60
          C55 72 50 82 39 96
        "
      />

      {/* Main XOR body */}
      <path
        d="
          M48 24
          C64 27 76 35 88 41
          C101 48 116 54 138 60
          C116 66 101 72 88 79
          C76 85 64 93 48 96
          C58 82 63 72 63 60
          C63 48 58 38 48 24
          Z
        "
      />
    </GateBase>
  );
}

/* -------------------------------------------------------------------------- */
/*                               XNOR GATE                                    */
/* -------------------------------------------------------------------------- */

export function XnorGateIcon(props: LogicGateIconProps) {
  return (
    <GateBase {...props}>
      {/* Extra XOR curved input line */}
      <path
        d="
          M39 24
          C50 38 55 48 55 60
          C55 72 50 82 39 96
        "
      />

      {/* Main XOR body */}
      <path
        d="
          M48 24
          C64 27 76 35 88 41
          C101 48 112 54 128 60
          C112 66 101 72 88 79
          C76 85 64 93 48 96
          C58 82 63 72 63 60
          C63 48 58 38 48 24
          Z
        "
      />

      {/* XNOR inversion bubble */}
      <circle
        cx="134"
        cy="60"
        r="6"
        fill="white"
      />

      {/* Output extension */}
      <line x1="140" y1="60" x2="168" y2="60" />
    </GateBase>
  );
}

/* -------------------------------------------------------------------------- */
/*                              GATE MAP                                      */
/* -------------------------------------------------------------------------- */

export const LogicGateIcons = {
  AND: AndGateIcon,
  OR: OrGateIcon,
  NOT: NotGateIcon,
  NAND: NandGateIcon,
  NOR: NorGateIcon,
  XOR: XorGateIcon,
  XNOR: XnorGateIcon,
};

/* -------------------------------------------------------------------------- */
/*                          GENERIC LOGIC GATE                                */
/* -------------------------------------------------------------------------- */

export function LogicGateIcon({
  type,
  ...props
}: LogicGateIconProps & {
  type: LogicGateType;
}) {
  const Gate = LogicGateIcons[type];

  return <Gate {...props} />;
}

export default LogicGateIcon;