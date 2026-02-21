import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export interface OdooConfig {
  baseUrl: string;
  db: string;
  username: string;
  apiKey: string;
}

export class OdooClient {
  private config: OdooConfig;
  private parser: XMLParser;
  private builder: XMLBuilder;

  constructor(config: OdooConfig) {
    this.config = config;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
    });
    this.builder = new XMLBuilder();
  }

  private async call(service: string, method: string, args: any[], retries = 3): Promise<any> {
    const url = `${this.config.baseUrl}/xmlrpc/2/${service}`;
    const xml = this.builder.build({
      methodCall: {
        methodName: method,
        params: {
          param: args.map(arg => ({ value: this.toXmlValue(arg) }))
        }
      }
    });

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml' },
          body: `<?xml version="1.0"?>\n${xml}`,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Odoo API error: ${response.statusText} (${response.status})`);
        }

        const text = await response.text();
        const result = this.parser.parse(text);

        if (result.methodResponse.fault) {
          throw new Error(`Odoo Fault: ${JSON.stringify(result.methodResponse.fault)}`);
        }

        return this.fromXmlValue(result.methodResponse.params.param.value);
      } catch (error: any) {
        const isLastAttempt = attempt === retries;
        const isNetworkError = error.name === 'AbortError' || error.message.includes('fetch');
        
        if (isLastAttempt || !isNetworkError) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        console.warn(`Odoo connection attempt ${attempt} failed, retrying in ${delay}ms...`);
      }
    }
  }

  private toXmlValue(val: any): any {
    if (typeof val === 'string') return { string: val };
    if (typeof val === 'number') return Number.isInteger(val) ? { int: val } : { double: val };
    if (typeof val === 'boolean') return { boolean: val ? 1 : 0 };
    if (Array.isArray(val)) return { array: { data: { value: val.map(v => this.toXmlValue(v)) } } };
    if (typeof val === 'object' && val !== null) {
      return {
        struct: {
          member: Object.entries(val).map(([k, v]) => ({
            name: k,
            value: this.toXmlValue(v)
          }))
        }
      };
    }
    return { nil: '' };
  }

  private fromXmlValue(val: any): any {
    if (!val) return null;
    if (val.string !== undefined) return val.string;
    if (val.int !== undefined) return val.int;
    if (val.double !== undefined) return val.double;
    if (val.boolean !== undefined) return val.boolean === 1 || val.boolean === true;
    if (val.array) {
      const data = val.array.data.value;
      return Array.isArray(data) ? data.map(v => this.fromXmlValue(v)) : [this.fromXmlValue(data)];
    }
    if (val.struct) {
      const members = Array.isArray(val.struct.member) ? val.struct.member : [val.struct.member];
      const obj: any = {};
      members.forEach((m: any) => {
        obj[m.name] = this.fromXmlValue(m.value);
      });
      return obj;
    }
    return null;
  }

  async authenticate(): Promise<number> {
    return this.call('common', 'authenticate', [
      this.config.db,
      this.config.username,
      this.config.apiKey,
      {}
    ]);
  }

  async execute(uid: number, model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    return this.call('object', 'execute_kw', [
      this.config.db,
      uid,
      this.config.apiKey,
      model,
      method,
      args,
      kwargs
    ]);
  }
}
