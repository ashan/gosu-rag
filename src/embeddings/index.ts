export { IEmbeddingProvider } from './IEmbeddingProvider';
export { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider';
export { GoogleEmbeddingProvider } from './GoogleEmbeddingProvider';
export { OllamaEmbeddingProvider } from './OllamaEmbeddingProvider';

import { IEmbeddingProvider } from './IEmbeddingProvider';
import { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider';
import { GoogleEmbeddingProvider } from './GoogleEmbeddingProvider';
import { OllamaEmbeddingProvider } from './OllamaEmbeddingProvider';
import { loadConfig, type Config } from '../config';

/**
 * Factory function to create the appropriate embedding provider based on config
 */
export function createEmbeddingProvider(config?: Config): IEmbeddingProvider {
    const cfg = config || loadConfig();

    switch (cfg.embeddingProvider) {
        case 'openai':
            return new OpenAIEmbeddingProvider();
        case 'google':
            return new GoogleEmbeddingProvider();
        case 'ollama':
            return new OllamaEmbeddingProvider();
        default:
            throw new Error(`Unsupported embedding provider: ${cfg.embeddingProvider}`);
    }
}

