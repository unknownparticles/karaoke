/**
 * Front-end Gemini AI Song Analyzer
 * Communicates directly with Google Gemini REST API.
 */

export interface AnalyzedSongResponse {
  title: string;
  artist: string;
  bpm: number;
  key: string;
  lyrics: {
    time: number;
    text: string;
  }[];
}

export async function analyzeSongWithGemini(
  songName: string,
  apiKey: string,
  url: string = 'None',
  lyricsText: string = 'None'
): Promise<AnalyzedSongResponse> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API Key 不能为空，请在设置中配置您的 Gemini API Key');
  }

  const prompt = `
    Please analyze the song specified below. 
    Input song identifier:
    - Song Name: ${songName || 'Unknown'}
    - URL/Link: ${url || 'None'}
    - Provided Lyrics/Text context: ${lyricsText || 'None'}

    Your task is to generate complete song details, including:
    1. Title & Artist (translate to standard clean readable names).
    2. Beats Per Minute (BPM) as a reasonable integer (e.g., between 60 and 150).
    3. Musical Key (e.g., "C Major", "A Minor", "G Major").
    4. A highly accurate, fully synchronized, timed timeline of lyrics where each line is prefixed with bracketed chords [Chord] placed EXACTLY at the character syllable where the chord changes.
    
    Example of timed lyrics format:
    - At time 0.0: "[C]Intro instrumental"
    - At time 12.0: "[C]故事的小黄[G/B]花从出生[Am]那年就[G]飘着"
    - At time 18.0: "[F]童年的荡秋[C/E]千随记忆[Dm7]一直晃到现[G]在"

    Use standard simple chords (like C, G, Am, F, Dm7, Em7, G/B, Cadd9) so they can be synthesized by our music player. Make sure chord transitions make sense musically (e.g. 1-5-6-4 progressions or variations) and spacing is realistic.
    Generate at least 8-15 lines representing the structure of the song (e.g. Intro, Verse 1, Pre-chorus, Chorus). Ensure the timeline progresses in seconds (e.g. 0.0, 4.0, 9.0, 14.5, 20.0, etc.) in ascending order.
  `;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: `You are an expert pop musicologist, chord transcriber, and lyric synchronizer. 
          Analyze the requested song and generate clean structured lyric chord progressions. 
          Always output the result as a strict, valid JSON object matching the requested schema. 
          Do not add markdown formatting outside of the JSON. Do not write text outside the JSON.`
        }
      ]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Clean name of the song' },
          artist: { type: 'STRING', description: 'Clean artist name' },
          bpm: { type: 'INTEGER', description: 'Estimated beats per minute' },
          key: { type: 'STRING', description: 'Key of the song (e.g., G Major)' },
          lyrics: {
            type: 'ARRAY',
            description: 'List of chronologically sorted lines with bracketed chord locations',
            items: {
              type: 'OBJECT',
              properties: {
                time: { type: 'NUMBER', description: 'Absolute start timestamp of this line in seconds' },
                text: { type: 'STRING', description: 'The text of the line, containing chords in brackets, e.g. [C]Hello [G]world' }
              },
              required: ['time', 'text']
            }
          }
        },
        required: ['title', 'artist', 'bpm', 'key', 'lyrics']
      }
    }
  };

  // We will try candidate models in order: gemini-2.5-flash -> gemini-1.5-flash
  const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    let attempts = 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`Front-end AI generation attempt using model: ${modelName} (attempt ${attempt}/${attempts})`);
        
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Extract content text
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textContent) {
          throw new Error('API 没有返回有效内容 (candidates[0].content.parts[0].text)');
        }

        const parsedData = JSON.parse(textContent.trim()) as AnalyzedSongResponse;
        
        // Validate required fields
        if (!parsedData.title || !parsedData.artist || !parsedData.lyrics) {
          throw new Error('返回的 JSON 结构不完整，缺少必要字段');
        }

        return parsedData;
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed on attempt ${attempt}: ${err.message || err}`);
        if (attempt < attempts) {
          // Short backoff delay
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
    }
  }

  throw lastError || new Error('所有 Gemini 模型解析均告失败，请检查您的 API Key 或网络连接');
}
