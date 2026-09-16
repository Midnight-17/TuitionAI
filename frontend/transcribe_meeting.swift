import Foundation
import Speech

let audioPath = "/Users/nishanth/Music/Music/Media.localized/Music/Unknown Artist/Unknown Album/Startit_VC_m1.m4a"
let url = URL(fileURLWithPath: audioPath)
let semaphore = DispatchSemaphore(value: 0)

SFSpeechRecognizer.requestAuthorization { status in
    guard status == .authorized else {
        fputs("Speech recognition authorization failed: \(status.rawValue)\n", stderr)
        semaphore.signal()
        return
    }
    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-SG")) else {
        fputs("Could not create speech recognizer\n", stderr)
        semaphore.signal()
        return
    }
    recognizer.defaultTaskHint = .dictation
    let request = SFSpeechURLRecognitionRequest(url: url)
    request.shouldReportPartialResults = false
    if #available(macOS 10.15, *) { request.requiresOnDeviceRecognition = false }
    recognizer.recognitionTask(with: request) { result, error in
        if let result = result, result.isFinal {
            print(result.bestTranscription.formattedString)
            semaphore.signal()
        } else if let error = error {
            fputs("Recognition error: \(error.localizedDescription)\n", stderr)
            semaphore.signal()
        }
    }
}

semaphore.wait()
