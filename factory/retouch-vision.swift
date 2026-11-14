// Apple Vision helper for factory/retouch-image.ts (ADR-0025). macOS 14 or later.
// Usage: retouch-vision <image> <outdir>
// Writes one 8-bit grayscale PNG per foreground instance (instance-<n>.png, full image size) to <outdir>
// and prints one JSON line: { width, height, instances: [file], texts: [{ text, confidence, x, y, w, h }] }.
// Text boxes are in pixels, top-left origin. It changes no pixel of the photo: retouch-image.ts does that.
import CoreImage
import Foundation
import ImageIO
import Vision

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

let args = CommandLine.arguments
guard args.count == 3 else { fail("usage: retouch-vision <image> <outdir>") }
let input = URL(fileURLWithPath: args[1])
let outdir = URL(fileURLWithPath: args[2])

guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
  let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
else { fail("cannot read \(input.path)") }
let width = image.width
let height = image.height

let handler = VNImageRequestHandler(cgImage: image, options: [:])
let instancesRequest = VNGenerateForegroundInstanceMaskRequest()
let textRequest = VNRecognizeTextRequest()
textRequest.recognitionLevel = .accurate
textRequest.usesLanguageCorrection = false
do { try handler.perform([instancesRequest, textRequest]) } catch { fail("Vision: \(error)") }

let context = CIContext()
let gray = CGColorSpaceCreateDeviceGray()
var files: [String] = []
if let observation = instancesRequest.results?.first {
  for instance in observation.allInstances {
    let buffer: CVPixelBuffer
    do {
      buffer = try observation.generateScaledMaskForImage(forInstances: IndexSet(integer: instance), from: handler)
    } catch { fail("mask \(instance): \(error)") }
    let file = outdir.appendingPathComponent("instance-\(instance).png")
    do {
      // L8 whatever the buffer format is (it has been 8-bit OneComponent8 so far, not Float32).
      try context.writePNGRepresentation(of: CIImage(cvPixelBuffer: buffer), to: file, format: .L8, colorSpace: gray)
    } catch { fail("write \(file.path): \(error)") }
    files.append(file.path)
  }
}

var texts: [[String: Any]] = []
for observation in textRequest.results ?? [] {
  guard let candidate = observation.topCandidates(1).first else { continue }
  let box = observation.boundingBox  // normalized, bottom-left origin
  texts.append([
    "text": candidate.string, "confidence": candidate.confidence,
    "x": box.minX * Double(width), "y": (1 - box.maxY) * Double(height),
    "w": box.width * Double(width), "h": box.height * Double(height),
  ])
}

let out: [String: Any] = ["width": width, "height": height, "instances": files, "texts": texts]
let json = try! JSONSerialization.data(withJSONObject: out)
print(String(data: json, encoding: .utf8)!)
