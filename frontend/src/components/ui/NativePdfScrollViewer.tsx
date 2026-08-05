// =============================================================
// JK INFOTECH ERP — Native XAML PDF ScrollViewer Wrapper
// File : src/components/ui/NativePdfScrollViewer.tsx
//
// Wraps the C++ PdfScrollViewerViewManager (Tally+Acrobat pattern).
// Exposes zoomIn/zoomOut/resetZoom/setZoom/fitWidth as imperative
// handle methods for the toolbar buttons.
// =============================================================

import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { UIManager, findNodeHandle, requireNativeComponent, View, Text, ScrollView, Image, ActivityIndicator } from "react-native";

const isNativeComponentRegistered = Boolean(
  UIManager.getViewManagerConfig && UIManager.getViewManagerConfig("PdfScrollViewer")
);

const RNPdfScrollViewer = isNativeComponentRegistered
  ? (requireNativeComponent("PdfScrollViewer") as any)
  : null;

const COMMANDS = () => {
  try {
    return UIManager.getViewManagerConfig("PdfScrollViewer")?.Commands ?? {};
  } catch {
    return {};
  }
};

export interface PdfScrollViewerHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setZoom: (scale: number) => void;
  fitWidth: (containerWidth: number) => void;
}

export interface PdfScrollViewerProps {
  pages: string[];
  pageWidth: number;
  pageHeight: number;
  onZoomChanged?: (event: { nativeEvent: { zoom: number } }) => void;
  style?: any;
}

const NativePdfScrollViewer = forwardRef<PdfScrollViewerHandle, PdfScrollViewerProps>(
  (props, ref) => {
    const nativeRef = useRef<any>(null);

    const dispatch = (commandName: string, args: any[] = []) => {
      try {
        const handle = findNodeHandle(nativeRef.current);
        if (handle == null) return;
        UIManager.dispatchViewManagerCommand(handle, commandName, args);
      } catch (e) {
        console.warn("Failed to dispatch command to PdfScrollViewer:", e);
      }
    };

    useImperativeHandle(ref, () => ({
      zoomIn:    ()           => dispatch("zoomIn"),
      zoomOut:   ()           => dispatch("zoomOut"),
      resetZoom: ()           => dispatch("resetZoom"),
      setZoom:   (scale)      => dispatch("setZoom", [scale]),
      fitWidth:  (containerW) => dispatch("fitWidth", [containerW]),
    }));

    if (!RNPdfScrollViewer) {
      // Fallback: standard RN ScrollView if process was not restarted yet
      return (
        <ScrollView style={props.style ?? { flex: 1 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 20, gap: 16 }}>
          {props.pages.map((pageUri, idx) => (
            <Image
              key={idx}
              source={{ uri: pageUri }}
              style={{
                width: props.pageWidth,
                height: props.pageHeight,
                backgroundColor: "#FFFFFF",
                borderWidth: 0.5,
                borderColor: "#CBD5E1",
              }}
              resizeMode="contain"
            />
          ))}
        </ScrollView>
      );
    }

    return (
      <RNPdfScrollViewer
        ref={nativeRef}
        pages={props.pages}
        pageWidth={props.pageWidth}
        pageHeight={props.pageHeight}
        onZoomChanged={props.onZoomChanged}
        style={props.style ?? { flex: 1 }}
      />
    );
  }
);

NativePdfScrollViewer.displayName = "NativePdfScrollViewer";

export default NativePdfScrollViewer;
