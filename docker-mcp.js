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
        encoding: 'utf8'
      });
      return output;
    } catch (error) {
      return `Error: Docker not running or not installed - ${error.message}`;
    }
  }

  /**
   * Get container logs
   */
  getContainerLogs(containerName, lines = 50) {
    try {
      const output = execSync(`docker logs --tail ${lines} ${containerName}`, {
        encoding: 'utf8'
      });
      return output;
    } catch (error) {
      return `Error: Could not get logs for ${containerName} - ${error.message}`;
    }
  }

  /**
   * Get container stats
   */
  getContainerStats(containerName) {
    try {
      const output = execSync(`docker stats ${containerName} --no-stream --format "table {{.Container}}\\t{{.MemUsage}}\\t{{.CPUPerc}}"`, {
        encoding: 'utf8'
      });
      return output;
    } catch (error) {
      return `Error: Could not get stats for ${containerName} - ${error.message}`;
    }
  }

  /**
   * Inspect container details
   */
  inspectContainer(containerName) {
    try {
      const output = execSync(`docker inspect ${containerName}`, {
        encoding: 'utf8'
      });
      return JSON.parse(output)[0];
    } catch (error) {
      return { error: `Could not inspect ${containerName} - ${error.message}` };
    }
  }

  /**
   * List images
   */
  listImages() {
    try {
      const output = execSync('docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"', {
        encoding: 'utf8'
      });
      return output;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }

  /**
   * Get Docker compose status
   */
  composeStatus() {
    try {
      const output = execSync('docker-compose ps', {
        encoding: 'utf8',
        cwd: process.cwd()
      });
      return output;
    } catch (error) {
      return `Error: Docker Compose not available - ${error.message}`;
    }
  }

  /**
   * Health check for service
   */
  healthCheck(containerName) {
    try {
      const inspect = execSync(`docker inspect --format='{{.State.Health.Status}}' ${containerName}`, {
        encoding: 'utf8'
      });
      return {
        container: containerName,
        status: inspect.trim(),
        healthy: inspect.trim() === 'healthy'
      };
    } catch (error) {
      return {
        container: containerName,
        error: error.message
      };
    }
  }

  static getInfo() {
    return {
      name: 'docker-mcp',
      version: '1.0.0',
      capabilities: ['containers', 'logs', 'stats', 'health'],
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
  } else if (process.argv[2] === 'images') {
    console.log(docker.listImages());
  } else if (process.argv[2] === 'logs') {
    const container = process.argv[3] || 'erlbrew-pos';
    const lines = process.argv[4] || 50;
    console.log(docker.getContainerLogs(container, lines));
  } else if (process.argv[2] === 'stats') {
    const container = process.argv[3] || 'erlbrew-pos';
    console.log(docker.getContainerStats(container));
  } else if (process.argv[2] === 'inspect') {
    const container = process.argv[3] || 'erlbrew-pos';
    console.log(JSON.stringify(docker.inspectContainer(container), null, 2));
  } else if (process.argv[2] === 'health') {
    const container = process.argv[3] || 'erlbrew-pos';
    console.log(JSON.stringify(docker.healthCheck(container), null, 2));
  } else if (process.argv[2] === 'compose') {
    console.log(docker.composeStatus());
  } else {
    console.log(DockerMCP.getInfo());
  }
}
