"use client"

// Web Speech API voice input wrapper for Textarea.
// Appends transcript to existing text (doesn't replace it).
// Gracefully hides the mic button if SpeechRecognition is unavailable (Firefox, some mobile).
import { useRef, useState } from "react"
import { Mic, Square } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value?: string
  onValueChange: (value: string) => void
  rows?: number
}

// Web Speech API types — not in lib.dom.d.ts by default in all TS configs.
// Using a minimal interface rather than importing @types/dom-speech-recognition
// to avoid an extra dependency.
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}
interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}
interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance
}
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function VoiceTextarea({ value = "", onValueChange, rows = 3, className, ...props }: Props) {
  const [isListening, setIsListening] = useState(false)
  // Lazy initialisation runs once on mount (client-only); avoids a setState-in-effect.
  const [isSupported] = useState<boolean>(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)
  )
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  // Captures interim results so they're not duplicated on commit
  const interimRef = useRef("")

  function startListening() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return

    const recognition: SpeechRecognitionInstance = new SR()
    recognition.lang = "en-IN"
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition

    const baseText = value

    recognition.onresult = (event) => {
      let interim = ""
      let final = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      interimRef.current = interim
      // Append finalized speech to whatever the user had typed already
      const combined = baseText + (baseText && (final || interim) ? " " : "") + final + interim
      onValueChange(combined.trimStart())
    }

    recognition.onend = () => {
      setIsListening(false)
      interimRef.current = ""
    }

    recognition.onerror = () => {
      setIsListening(false)
      interimRef.current = ""
    }

    recognition.start()
    setIsListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        rows={rows}
        className={cn("pr-10", isListening && "ring-2 ring-red-400", className)}
        {...props}
      />
      {isSupported && (
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          aria-label={isListening ? "Stop recording" : "Start voice input"}
          className={cn(
            "absolute right-2 top-2 rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isListening
              ? "text-red-500 hover:text-red-600"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {isListening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-3.5" />}
        </button>
      )}
    </div>
  )
}
