FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:18

# Install additional global packages
RUN npm install -g yo generator-code vsce

# [Optional] Install additional OS packages if needed
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
     && apt-get -y install --no-install-recommends \
          libnss3 \
          libdbus-1-3 \
          libatk1.0-0 \
          libatk-bridge2.0-0 \
          libcups2 \
          libdrm2 \
          libgtk-3-0 \
          libgbm1 \
          libasound2 \
          xvfb \
          xauth \
          x11-utils \
          dbus-x11

# [Optional] Set the default user
USER node

# [Optional] Set the default directory
WORKDIR /workspace
