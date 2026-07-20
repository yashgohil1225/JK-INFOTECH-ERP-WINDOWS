import { Image } from "react-native";
import React from "react";
import Svg, { Path, Rect, Circle, Polygon } from "react-native-svg";

export function DashboardIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={7} height={9} rx={1} fill="#3B82F6" />
      <Rect x={14} y={3} width={7} height={5} rx={1} fill="#60A5FA" />
      <Rect x={3} y={16} width={7} height={5} rx={1} fill="#93C5FD" />
      <Rect x={14} y={12} width={7} height={9} rx={1} fill="#2563EB" />
    </Svg>
  );
}

export function InvoicesIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={2} width={16} height={20} rx={2} fill="#CBD5E1" />
      <Rect x={7} y={6} width={10} height={2} rx={0.5} fill="#3B82F6" />
      <Rect x={7} y={10} width={10} height={2} rx={0.5} fill="#64748B" />
      <Rect x={7} y={14} width={7} height={2} rx={0.5} fill="#94A3B8" />
    </Svg>
  );
}

export function SalesOrdersIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={18} rx={2} fill="#F1F5F9" stroke="#107C41" strokeWidth={2} />
      <Rect x={8} y={2} width={8} height={4} rx={1} fill="#107C41" />
      <Path d="M9 10L11 12L15 8" stroke="#107C41" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 16H16" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ReturnsIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12H20M4 12L9 7M4 12L9 17" stroke="#F7630C" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 12C20 8.68629 17.3137 6 14 6" stroke="#FDA4AF" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function CustomersIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} fill="#8764B8" />
      <Path d="M6 20C6 16.6863 9.31371 14 13.5 14C17.6863 14 21 16.6863 21 20" fill="#B4A0D8" />
    </Svg>
  );
}

export function VendorsIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={10} width={8} height={12} fill="#008272" />
      <Rect x={14} y={6} width={8} height={16} fill="#005C50" />
      <Polygon points="10,14 14,14 14,22 10,22" fill="#A7F3D0" />
    </Svg>
  );
}

export function InventoryIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L3 7L12 12L21 7L12 2Z" fill="#FBBF24" />
      <Path d="M3 7V17L12 22V12L3 7Z" fill="#D97706" />
      <Path d="M21 7V17L12 22V12L21 7Z" fill="#F59E0B" />
    </Svg>
  );
}

export function PurchasesIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8} cy={21} r={2} fill="#B4009E" />
      <Circle cx={18} cy={21} r={2} fill="#B4009E" />
      <Path d="M3 3H5L8 16H19L21 6H6" stroke="#D946EF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BankIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon points="12,2 2,7 22,7" fill="#00B7C3" />
      <Rect x={4} y={9} width={3} height={9} fill="#008B94" />
      <Rect x={10} y={9} width={3} height={9} fill="#008B94" />
      <Rect x={16} y={9} width={3} height={9} fill="#008B94" />
      <Rect x={2} y={19} width={20} height={3} fill="#005F65" />
    </Svg>
  );
}

export function ReportsIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 20H21" stroke="#8764B8" strokeWidth={2} strokeLinecap="round" />
      <Path d="M5 16L9 11L14 14L19 7" stroke="#A855F7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={19} cy={7} r={2} fill="#C084FC" />
    </Svg>
  );
}

export function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} fill="#64748B" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="#64748B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BrandTextLogo({ fill = "#1B4D7A", width = 120, height = 35 }: { fill?: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 492 143" fill="none">
      <Path d="M62.128 34.992V65.584Q62.128 72.688 58.128 76.52799999999999Q54.128 80.368 47.344 80.368Q40.24 80.368 35.952 76.336Q31.664 72.304 31.664 64.88H42.544Q42.544 67.696 43.696 69.136Q44.848 70.57600000000001 47.024 70.57600000000001Q49.007999999999996 70.57600000000001 50.096 69.296Q51.184 68.016 51.184 65.584V34.992Z" fill={fill} />
      <Path d="M98.508 79.92 83.404 60.08V79.92H72.46V34.992H83.404V54.704L98.38 34.992H111.244L93.83599999999998 57.008L111.88399999999999 79.92Z" fill={fill} />
      <Path d="M144.58 34.992V79.92H133.636V34.992Z" fill={fill} />
      <Path d="M194.208 79.92H183.264L164.96 52.208V79.92H154.016V34.992H164.96L183.264 62.832V34.992H194.208Z" fill={fill} />
      <Path d="M232.892 34.992V43.76H214.588V53.232H228.284V61.744H214.588V79.92H203.64399999999998V34.992Z" fill={fill} />
      <Path d="M238.296 57.328Q238.296 50.736000000000004 241.39999999999998 45.488Q244.504 40.24 249.784 37.29600000000001Q255.064 34.352000000000004 261.4 34.352000000000004Q267.736 34.352000000000004 273.01599999999996 37.29600000000001Q278.296 40.24 281.336 45.488Q284.376 50.736000000000004 284.376 57.328Q284.376 63.92 281.304 69.2Q278.23199999999997 74.48 272.984 77.424Q267.736 80.368 261.4 80.368Q255.064 80.368 249.784 77.424Q244.504 74.48 241.39999999999998 69.2Q238.296 63.92 238.296 57.328ZM273.24 57.328Q273.24 51.376000000000005 270.00800000000004 47.824Q266.776 44.272 261.4 44.272Q255.96 44.272 252.728 47.792Q249.496 51.312 249.496 57.328Q249.496 63.28 252.728 66.832Q255.96 70.384 261.4 70.384Q266.776 70.384 270.00800000000004 66.8Q273.24 63.216 273.24 57.328Z" fill={fill} />
      <Path d="M324.276 34.992V43.76H312.372V79.92H301.428V43.76H289.524V34.992Z" fill={fill} />
      <Path d="M342.224 43.76V52.848H356.88V61.29600000000001H342.224V71.152H358.8V79.92H331.28000000000003V34.992H358.8V43.76Z" fill={fill} />
      <Path d="M388.14000000000004 34.480000000000004Q396.14000000000004 34.480000000000004 401.836 38.70400000000001Q407.53200000000004 42.928000000000004 409.45200000000006 50.224000000000004H397.42Q396.076 47.408 393.612 45.936Q391.148 44.464 388.01200000000006 44.464Q382.956 44.464 379.82000000000005 47.984Q376.684 51.504000000000005 376.684 57.392Q376.684 63.28 379.82000000000005 66.80000000000001Q382.956 70.32000000000001 388.01200000000006 70.32000000000001Q391.148 70.32000000000001 393.612 68.84800000000001Q396.076 67.376 397.42 64.56H409.45200000000006Q407.53200000000004 71.856 401.836 76.048Q396.14000000000004 80.24 388.14000000000004 80.24Q381.612 80.24 376.46000000000004 77.328Q371.30800000000005 74.416 368.42800000000005 69.232Q365.54800000000006 64.048 365.54800000000006 57.392Q365.54800000000006 50.736000000000004 368.42800000000005 45.52Q371.30800000000005 40.304 376.46000000000004 37.392Q381.612 34.480000000000004 388.14000000000004 34.480000000000004Z" fill={fill} />
      <Path d="M456.58400000000006 34.992V79.92H445.64000000000004V61.42400000000001H428.61600000000004V79.92H417.6720000000001V34.992H428.61600000000004V52.592H445.64000000000004V34.992Z" fill={fill} />
    </Svg>
  );
}

export function BrandMonogram({ fill = "#1B4D7A", size = 28 }: { fill?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Rect x={0} y={0} width={512} height={512} rx={96} ry={96} fill={fill} />
      <Path d="M 152 112 L 196 112 L 196 300 C 196 354 166 384 116 384 C 96 384 78 380 62 372 L 62 330 C 75 337 89 341 102 341 C 130 341 152 326 152 296 Z" fill="#FFFFFF" />
      <Path d="M 246 112 L 290 112 L 290 234 L 380 112 L 432 112 L 332 246 L 438 384 L 384 384 L 290 256 L 290 384 L 246 384 Z" fill="#FFFFFF" />
    </Svg>
  );
}

// ─── Custom KPI Icons from User SVGs (UWP Safe PNG Rasterized) ───────

export function TotalSalesKPIIcon({ size = 20 }: { size?: number }) {
  return (
    <Image
      source={require("../total_sales.png")}
      style={{ width: size, height: size, resizeMode: "contain" }}
    />
  );
}

export function TotalReceivablesKPIIcon({ size = 20 }: { size?: number }) {
  return (
    <Image
      source={require("../total_receivables.png")}
      style={{ width: size, height: size, resizeMode: "contain" }}
    />
  );
}

export function TotalPayablesKPIIcon({ size = 20 }: { size?: number }) {
  return (
    <Image
      source={require("../total_payable.png")}
      style={{ width: size, height: size, resizeMode: "contain" }}
    />
  );
}

export function ActiveCustomersKPIIcon({ size = 20 }: { size?: number }) {
  return (
    <Image
      source={require("../active_customers.png")}
      style={{ width: size, height: size, resizeMode: "contain" }}
    />
  );
}
