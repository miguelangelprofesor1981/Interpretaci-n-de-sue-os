import { GoogleGenAI, Modality, Type } from "@google/genai";
import { UserProfile, DreamContext } from "../types";

// Ensure API Key is present
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing from environment variables");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });

// Helper to encode image to base64 (stripping header if needed for some APIs, though GenAI SDK usually handles inlineData well)
// We will keep the raw base64 (without data:image/png;base64 prefix) for the SDK
const cleanBase64 = (dataUrl: string) => dataUrl.split(',')[1];

// Helper to manually decode PCM (Int16) data into an AudioBuffer
// Gemini TTS returns raw PCM data without headers, so ctx.decodeAudioData fails.
const decodePCM = (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): AudioBuffer => {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize Int16 value to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

export const analyzeDream = async (
  user: UserProfile,
  dream: DreamContext
): Promise<string> => {
  const prompt = `
    Actúa como un experto onírico surrealista y profundo. 
    Analiza el siguiente sueño.
    
    CONTEXTO DEL SOÑADOR:
    Nombre: ${user.fullName}
    Edad: ${user.age}
    Ciudad Natal: ${user.birthCity}
    Fecha de Análisis: ${user.currentDate}
    
    DETALLES DEL SUEÑO:
    Fecha del sueño: ${dream.dreamDate}
    Hora del sueño: ${dream.dreamTime}
    Relato: ${dream.dreamText}
    Notas adicionales: ${dream.additionalNotes}

    INSTRUCCIONES:
    Provee una interpretación profunda y estructurada en formato Markdown.
    IMPORTANTE: Usa encabezados de nivel 3 (###) para separar visualmente las secciones.
    
    ESTRUCTURA REQUERIDA:
    
    ### 🧠 Interpretación Personal y Psicológica
    (Usa conceptos de Freud, Jung y psicoanálisis moderno para analizar emociones y familia).
    
    ### 🌌 Interpretación Universal y Metafísica
    (Usa simbología ancestral, arquetipos, y conceptos espirituales/religiosos).
    
    ### 🔮 Perspectiva Futurista
    (Basado en la hora, fecha y simbolismo, ofrece una visión profética, advertencia o guía).
    
    El tono debe ser misterioso, artístico pero claro y útil.
  `;

  // Using gemini-3-pro-preview with Thinking capability for deep analysis
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // Max thinking for deep analysis
      }
    });
    return response.text || "No se pudo generar la interpretación.";
  } catch (error) {
    console.error("Error analyzing dream:", error);
    throw error;
  }
};

export const searchSymbolism = async (query: string): Promise<{ text: string, sources: any[] }> => {
  // Using gemini-2.5-flash with Google Search for up-to-date info on symbols
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Investiga el significado simbólico actual y cultural de: ${query}. Provee un resumen breve.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { text: response.text || "", sources };
  } catch (error) {
    console.error("Error searching symbolism:", error);
    return { text: "Error buscando símbolos.", sources: [] };
  }
};

export const chatWithPsychoanalyst = async (history: { role: string, parts: { text: string }[] }[], message: string) => {
  // Using gemini-3-pro-preview for the intelligent chatbot assistant
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      history: history,
      config: {
        systemInstruction: "Eres un psicoanalista de guardia para emergencias noctámbulas. Tu tono es calmado, profesional pero empático. Ayuda al usuario a calmarse y entender sus emociones.",
      }
    });

    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
  // Using gemini-2.5-flash-preview-tts
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Deep voice for mystery
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Manually decode PCM data (Raw Int16, no header)
    return decodePCM(bytes, outputAudioContext, 24000, 1);
  } catch (error) {
    console.error("TTS error:", error);
    return null;
  }
};

export const generateDreamImage = async (prompt: string): Promise<string | null> => {
    // Using gemini-2.5-flash-image (Nano Banana) to Generate or Edit
    // Since generateImages (Imagen) is distinct, we use flash-image for "editing" or complex generation via text prompt.
    // For this feature, we will try to generate a visualization. 
    // Note: Flash-Image is often used for editing/understanding, but we can ask it to generate an image via 'imagen-4.0-generate-001' for high quality creation first, 
    // OR use flash-image if we have an input. 
    // Let's use Imagen 3 for creation as it is standard for generation, but the prompt asked for "Nano banana powered app" to EDIT.
    // So we will implement an Edit function.
    
    // For initial creation, let's use Imagen.
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `Surrealist dream art: ${prompt}`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '4:3',
        },
      });
      const base64 = response.generatedImages?.[0]?.image?.imageBytes;
      return base64 ? `data:image/jpeg;base64,${base64}` : null;
    } catch (e) {
      console.error("Image Gen Error", e);
      return null;
    }
}

export const editDreamImage = async (imageBase64: string, editInstruction: string): Promise<string | null> => {
  // Using gemini-2.5-flash-image for editing (Nano Banana feature)
  try {
    const cleanData = cleanBase64(imageBase64);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanData,
              mimeType: 'image/jpeg', // Assuming jpeg for simplicity
            },
          },
          {
            text: editInstruction,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part && part.inlineData) {
       return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) {
    console.error("Image Edit Error:", error);
    throw error;
  }
};
