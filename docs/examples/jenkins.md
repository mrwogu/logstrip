---
title: Compress Jenkins pipeline logs with LogStrip
description: Trim noisy Jenkins console output before forwarding to an AI agent. Declarative pipelines, scripted pipelines, archiveArtifacts, post-build steps.
---
# Jenkins

Jenkins console logs mix plugin chatter, shell traces (`+ ...`), and tool
output into one stream. The recipes below run inside a `sh` step on any
Linux agent with `npx` available.

## Declarative pipeline

```groovy
pipeline {
  agent any

  stages {
    stage('Test') {
      steps {
        sh 'npm test > raw_logs.txt 2>&1 || true'
      }
    }

    stage('Compress logs') {
      steps {
        sh '''
          npx -y logstrip raw_logs.txt -o clean.log --stats
        '''
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'clean.log', fingerprint: true
    }
  }
}
```

## Scripted pipeline with failure-only compression

```groovy
node('linux') {
  try {
    stage('Test') {
      sh 'npm test > raw_logs.txt 2>&1'
    }
  } catch (err) {
    stage('Compress logs for triage') {
      sh '''
        npx -y logstrip raw_logs.txt \
          -o clean.log \
          --json > stats.json
      '''
      archiveArtifacts artifacts: 'clean.log,stats.json'
    }
    throw err
  }
}
```

## Capture the Jenkins console log itself

If you want to compress the full console output (not just your test step),
fetch it from Jenkins via the REST API in a post-build step:

```groovy
post {
  always {
    sh """
      curl -s -u "\$JENKINS_USER:\$JENKINS_TOKEN" \\
        "\$BUILD_URL/consoleText" > console.log

      npx -y logstrip console.log -o clean.log --stats
    """
    archiveArtifacts artifacts: 'clean.log'
  }
}
```

Configure `JENKINS_USER` and `JENKINS_TOKEN` as credentials in Jenkins,
not as plain environment variables.

## Multi-branch pipeline with per-branch compression

```groovy
pipeline {
  agent any

  stages {
    stage('Build & Test') {
      steps {
        sh "make test > raw-${env.BRANCH_NAME}.log 2>&1 || true"
        sh """
          npx -y logstrip raw-${env.BRANCH_NAME}.log \
            -o clean-${env.BRANCH_NAME}.log \
            --stats
        """
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: "clean-${env.BRANCH_NAME}.log"
    }
  }
}
```

## Send compact logs to an AI agent

```groovy
stage('Triage') {
  when { expression { currentBuild.result == 'FAILURE' } }
  steps {
    sh '''
      npx -y logstrip raw_logs.txt -o clean.log
      your-ai-agent analyze --file clean.log > triage.md
    '''
    archiveArtifacts artifacts: 'triage.md'
  }
}
```

See the [CLI reference](../reference/cli.md) for every flag and exit code.
