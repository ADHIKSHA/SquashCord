FROM node:lts-alpine
LABEL maintainer "Akashdeep Dhar <t0xic0der@fedoraproject.org>"
COPY . .
WORKDIR .
RUN npm install
ENTRYPOINT ["npm", "start"]