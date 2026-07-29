#!/usr/bin/env node

/**
 * Docker MCP Server
 * Inspect container status, logs, and manage services
 */

import { execSync } from 'child_process';

class DockerMCP {
  constructor() {
    this.projectName = 'erlbrew-pos';
  }

  /**
   * List running containers
   */
  listContainers() {
    try {
      const output = execSync('docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}"', {
        encoding: 'utf8',
        timeout: 10000
      });
      return output;
    } catch (error) {
      throw new Error(`Failed to list containers: ${error.message}`);
    }
  }

  /**
   * Check service health
   */
  checkServiceHealth(containerName) {
    try {
      const status = execSync(`docker inspect --format '{{.State.Status}}' ${containerName}`, {
        encoding: 'utf8',
        timeout: 5000
      }).trim();
      return { container: containerName, status };
    } catch (error) {
      return { container: containerName, status: 'not found', error: error.message };
    }
  }

  /**
   * Get container logs
   */
  getLogs(containerName, lines = 50) {
    try {
      const output = execSync(`docker logs --tail ${lines} ${containerName}`, {
        encoding: 'utf8',
        timeout: 10000
      });
      return output;
    } catch (error) {
      throw new Error(`Failed to get logs: ${error.message}`);
    }
  }

  /**
   * List project images
   */
  listImages() {
    try {
      const output = execSync('docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"', {
        encoding: 'utf8',
        timeout: 10000
      });
      return output;
    } catch (error) {
      throw new Error(`Failed to list images: ${error.message}`);
    }
  }

  /**
   * Start a service
   */
  startService(serviceName) {
    try {
      const output = execSync(`docker compose up -d ${serviceName}`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 30000
      });
      return output;
    } catch (error) {
      throw new Error(`Failed to start service: ${error.message}`);
    }
  }

  /**
   * Stop a service
   */
  stopService(serviceName) {
    try {
      const output = execSync(`docker compose stop ${serviceName}`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 30000
      });
      return output;
    } catch (error) {
      throw new Error(`Failed to stop service: ${error.message}`);
    }
  }

  static getInfo() {
    return {
      name: 'docker-mcp',
      version: '1.0.0',
      capabilities: ['containers', 'logs', 'health', 'compose'],
      description: 'MCP server for Docker container inspection and management'
    };
  }
}

export default DockerMCP;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const docker = new DockerMCP();
  
  if (process.argv[2] === 'containers') {
    console.log(docker.listContainers());
  } else if (process.argv[2] === 'logs' && process.argv[3]) {
    console.log(docker.getLogs(process.argv[3], parseInt(process.argv[4]) || 50));
  } else if (process.argv[2] === 'images') {
    console.log(docker.listImages());
  } else if (process.argv[2] === 'health' && process.argv[3]) {
    console.log(docker.checkServiceHealth(process.argv[3]));
  } else {
    console.log(DockerMCP.getInfo());
  }
}
