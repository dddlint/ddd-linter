#!/usr/bin/env node

import { program } from 'commander';
import simpleGit from 'simple-git';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { execSync } from 'child_process';

// Define the glossary schema based on contextive.tech
interface Term {
  name: string;
  definition: string;
  examples?: string[];
  aliases?: string[];
  related?: string[];
}

interface Context {
  name: string;
  domainVisionStatement?: string;
  meta?: Record<string, string>;
  terms: Term[];
}

interface GlossaryFile {
  contexts: Context[];
}

async function main() {
  program
    .requiredOption('--repo-url <url>', 'URL of the glossary repository to clone')
    .requiredOption('--domain <domain>', 'Domain name for the glossary')
    .requiredOption('--files <pattern>', 'Regex pattern to match files for analysis')
    .parse(process.argv);

  const options = program.opts();
  const repoUrl = options.repoUrl;
  const domain = options.domain;
  const filesPattern = options.files;

  console.log(`Starting DDD glossary operation for domain: ${domain}`);
  
  try {
    // Setup paths
    const workDir = path.join(process.cwd(), 'glossary-repo');
    const domainsDir = path.join(workDir, 'domains');
    const glossaryFile = path.join(domainsDir, `${domain}.glossary.yml`);
    
    // Clone or update the repository
    await cloneOrUpdateRepo(repoUrl, workDir);
    
    // Create domains directory if it doesn't exist
    await fs.ensureDir(domainsDir);
    
    // Create glossary file if it doesn't exist
    if (!await fs.pathExists(glossaryFile)) {
      await createEmptyGlossaryFile(glossaryFile);
      console.log(`Created new glossary file: ${glossaryFile}`);
    } else {
      console.log(`Using existing glossary file: ${glossaryFile}`);
    }
    
    // Use Claude CLI to analyze files and update glossary
    await analyzeFilesWithClaude(filesPattern, domain, glossaryFile);
    
    console.log('DDD glossary operation completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function cloneOrUpdateRepo(repoUrl: string, workDir: string): Promise<void> {
  const git = simpleGit();
  
  if (await fs.pathExists(workDir)) {
    console.log('Repository already exists locally, updating...');
    const repoGit = simpleGit(workDir);
    await repoGit.pull();
    console.log('Repository updated successfully');
  } else {
    console.log(`Cloning repository from ${repoUrl}...`);
    await git.clone(repoUrl, workDir);
    console.log('Repository cloned successfully');
  }
}

async function createEmptyGlossaryFile(filePath: string): Promise<void> {
  const emptyGlossary: GlossaryFile = {
    contexts: [{
      name: path.basename(filePath, '.glossary.yml'),
      domainVisionStatement: '',
      terms: []
    }]
  };
  
  await fs.writeFile(filePath, yaml.stringify(emptyGlossary));
}

async function analyzeFilesWithClaude(
  filesPattern: string, 
  domain: string, 
  glossaryFile: string
): Promise<void> {
  console.log(`Analyzing files matching pattern: "${filesPattern}" for domain: ${domain}`);
  
  try {
    // Read current glossary first to provide context
    const currentGlossary = await readGlossaryFile(glossaryFile);
    
    // Convert the glossary to YAML string for Claude's reference
    const currentGlossaryYaml = yaml.stringify(currentGlossary);
    
    // Prepare the prompt for Claude including current glossary
    const prompt = `
You need to analyze source code files matching the pattern: "${filesPattern}" for Domain-Driven Design concepts in the '${domain}' domain.

For this task:
1. First, find files matching this pattern. This might be a directory path like "../all-my-things/src" or a regex pattern.
2. If it's a directory path, analyze all files in that directory and its subdirectories.
3. If it's a regex pattern, find and analyze all matching files.
4. Exclude files in node_modules and .git directories.
5. Pay special attention to domain entities, value objects, aggregates, and services as defined in Domain-Driven Design.

Here is the current glossary for this domain:

\`\`\`yaml
${currentGlossaryYaml}
\`\`\`

Compare your findings with the existing glossary. Focus on:
- Identifying new terms not yet in the glossary
- Finding definitions that could be improved
- Discovering new aliases for existing terms
- Adding relevant examples from the code

For each domain model or concept you identify:
1. Extract the term name
2. Write a clear definition
3. List any aliases (synonyms) found in the code
4. Provide examples of usage from the code if available
5. Note any related terms

VERY IMPORTANT: Your response MUST be valid YAML with this EXACT structure:

\`\`\`yaml
contexts:
  - name: "${domain}"
    domainVisionStatement: "A concise statement about the purpose of this domain"
    terms:
      - name: "TermName1"
        definition: "Definition of the first term"
        aliases: ["synonym1", "synonym2"]
        examples: ["Example usage from code"]
        related: ["RelatedTerm1", "RelatedTerm2"]
      - name: "TermName2"
        definition: "Definition of the second term"
        aliases: ["synonym3", "synonym4"]
        examples: ["Example usage from code"]
        related: ["RelatedTerm3", "RelatedTerm4"]
\`\`\`

The response structure MUST include:
1. A "contexts" array with at least one context object
2. Each context MUST have a "name" property and a "terms" array
3. The "terms" array MUST contain term objects, each with at least a "name" and "definition" property
4. DO NOT introduce any other fields like "factories", "repositories", or "services" at the root level

Only include terms that seem to be part of the domain model, not technical implementation details.
`;
    
    // Let Claude handle the file discovery directly
    console.log('Calling Claude for analysis...');
    
    // We need to properly escape the prompt for shell execution
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/`/g, '\\`');
    const claudeCommand = `claude -p "${escapedPrompt}"`;
    
    // Alternative approach using temporary file if escaping doesn't work
    const promptFilePath = path.join(process.cwd(), 'temp-prompt.txt');
    await fs.writeFile(promptFilePath, prompt);
    console.log(`Saved prompt to temporary file: ${promptFilePath}`);
    
    try {
      console.log('Executing Claude command...');
      const claudeOutput = execSync(claudeCommand, { encoding: 'utf-8' });
      
      console.log(`Claude output received (length: ${claudeOutput.length})`);
      console.log('First 10000 characters:', claudeOutput.substring(0, 10000).replace(/\n/g, ' '));
      
      // Check if we can find YAML blocks
      const yamlBlockExists = claudeOutput.includes('```yaml') || claudeOutput.includes('```yml');
      console.log('YAML code block exists:', yamlBlockExists);
      
      if (!yamlBlockExists) {
        console.log('No YAML block found, here\'s the full output:');
        console.log(claudeOutput);
      }

      console.log('Parsing Claude output into glossary terms...');
      const extractedTerms = parseClaudeOutput(claudeOutput, domain);
      
      // Log structure of extracted terms
      console.log('Extracted terms structure:');
      console.log('- Number of contexts:', extractedTerms.contexts.length);
      for (const ctx of extractedTerms.contexts) {
        console.log(`- Context "${ctx.name}": ${ctx.terms?.length || 0} terms`);
        if (!ctx.terms || !Array.isArray(ctx.terms)) {
          console.error('ERROR: Context has no terms array:', ctx);
        }
      }
      
      // Merge with existing glossary
      console.log('Merging with existing glossary...');
      mergeGlossaryTerms(currentGlossary, extractedTerms);
      
      // Save updated glossary
      await fs.writeFile(glossaryFile, yaml.stringify(currentGlossary));
      const totalTerms = extractedTerms.contexts.reduce(
        (sum, context) => sum + (Array.isArray(context.terms) ? context.terms.length : 0), 
        0
      );
      console.log(`Updated glossary file with ${totalTerms} term(s)`);
    } catch (claudeError) {
      console.error('Error running Claude CLI:', claudeError);
      if (claudeError instanceof Error) {
        console.error('Error message:', claudeError.message);
        console.error('Error stack:', claudeError.stack);
      }
    }
  } catch (error) {
    console.error('Error analyzing files:', error);
  }
}

async function readGlossaryFile(filePath: string): Promise<GlossaryFile> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const parsed = yaml.parse(fileContent) as GlossaryFile;
    
    // Handle migration from old format if needed
    if ('terms' in parsed && !('contexts' in parsed)) {
      return {
        contexts: [{
          name: path.basename(filePath, '.glossary.yml'),
          terms: []
        }]
      };
    }
    
    return parsed;
  } catch (error) {
    console.error('Error reading glossary file:', error);
    return { 
      contexts: [{
        name: path.basename(filePath, '.glossary.yml'),
        terms: []
      }]
    };
  }
}

function parseClaudeOutput(output: string, domain: string): GlossaryFile {
  try {
    // Try to extract YAML content from Claude's response
    const yamlMatch = output.match(/```yaml\s*([\s\S]*?)\s*```/) || 
                      output.match(/```yml\s*([\s\S]*?)\s*```/) ||
                      [null, output]; // If no code block, try parsing the whole output
    
    if (yamlMatch && yamlMatch[1]) {
      const parsedContent = yaml.parse(yamlMatch[1]);
      
      // Handle different possible outputs from Claude
      if (parsedContent?.terms && Array.isArray(parsedContent.terms)) {
        // Old format - convert to new format
        return {
          contexts: [{
            name: domain,
            terms: parsedContent.terms.map((term: any) => ({
              name: term.term || term.name || 'Unknown term',
              definition: term.definition || '',
              examples: Array.isArray(term.examples) ? term.examples : [],
              aliases: Array.isArray(term.synonyms) ? term.synonyms : 
                      Array.isArray(term.aliases) ? term.aliases : [],
              related: Array.isArray(term.related) ? term.related : []
            }))
          }]
        };
      } else if (parsedContent?.contexts && Array.isArray(parsedContent.contexts)) {
        // Already in correct format but ensure each context has a terms array
        const sanitizedContexts = parsedContent.contexts.map((ctx: any) => ({
          name: ctx.name || domain,
          domainVisionStatement: ctx.domainVisionStatement || '',
          meta: ctx.meta || {},
          terms: Array.isArray(ctx.terms) ? ctx.terms.map((term: any) => ({
            name: term.name || 'Unknown term',
            definition: term.definition || '',
            examples: Array.isArray(term.examples) ? term.examples : [],
            aliases: Array.isArray(term.aliases) ? term.aliases : [],
            related: Array.isArray(term.related) ? term.related : []
          })) : []
        }));
        
        return { contexts: sanitizedContexts };
      }
    }
    
    console.warn('Could not parse Claude output as YAML, returning empty contexts list');
    return { 
      contexts: [{
        name: domain,
        terms: []
      }]
    };
  } catch (error) {
    console.error('Error parsing Claude output:', error);
    return { 
      contexts: [{
        name: domain,
        terms: []
      }]
    };
  }
}

function mergeGlossaryTerms(currentGlossary: GlossaryFile, newTerms: GlossaryFile): void {
  // Ensure we have at least one context
  if (!currentGlossary.contexts || currentGlossary.contexts.length === 0) {
    currentGlossary.contexts = [{ name: 'Default', terms: [] }];
  }
  
  // Process each context in new terms
  for (const newContext of newTerms.contexts) {
    // Find or create corresponding context in current glossary
    let targetContext = currentGlossary.contexts.find(c => c.name === newContext.name);
    if (!targetContext) {
      targetContext = {
        name: newContext.name,
        terms: []
      };
      currentGlossary.contexts.push(targetContext);
    }
    
    // Update domain vision statement if provided and current is empty
    if (newContext.domainVisionStatement && (!targetContext.domainVisionStatement || targetContext.domainVisionStatement === '')) {
      targetContext.domainVisionStatement = newContext.domainVisionStatement;
    }
    
    // Update meta data if provided
    if (newContext.meta) {
      targetContext.meta = { ...(targetContext.meta || {}), ...newContext.meta };
    }
    
    // Ensure terms exist and are iterable
    if (!newContext.terms || !Array.isArray(newContext.terms)) {
      console.warn(`Context '${newContext.name}' has no terms or terms is not an array`);
      continue;
    }
    
    // Process each term in the context
    for (const newTerm of newContext.terms) {
      // Check if term already exists
      const existingTermIndex = targetContext.terms.findIndex(
        t => t.name.toLowerCase() === newTerm.name.toLowerCase()
      );
      
      if (existingTermIndex >= 0) {
        // Merge with existing term
        const existingTerm = targetContext.terms[existingTermIndex];
        
        // Update definition if new one is more comprehensive
        if (newTerm.definition && newTerm.definition.length > existingTerm.definition.length) {
          existingTerm.definition = newTerm.definition;
        }
        
        // Merge aliases (previously synonyms)
        if (newTerm.aliases && newTerm.aliases.length > 0) {
          existingTerm.aliases = [...new Set([
            ...(existingTerm.aliases || []),
            ...newTerm.aliases
          ])];
        }
        
        // Merge examples
        if (newTerm.examples && newTerm.examples.length > 0) {
          existingTerm.examples = [...new Set([
            ...(existingTerm.examples || []),
            ...newTerm.examples
          ])];
        }
        
        // Merge related terms
        if (newTerm.related && newTerm.related.length > 0) {
          existingTerm.related = [...new Set([
            ...(existingTerm.related || []),
            ...newTerm.related
          ])];
        }
      } else {
        // Add new term
        targetContext.terms.push(newTerm);
      }
    }
  }
}

main().catch(console.error);