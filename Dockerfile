FROM node:6.11

ENV USER_DIR /candy-red-user
ENV CR_HOME /candy-red
ENV CR_DIST /candy-red-dist

RUN ( \
  mkdir -p ${CR_HOME} \
  mkdir -p ${CR_DIST} \
)

COPY ./package.json ${CR_HOME}
COPY ./docker/start.sh ${CR_HOME}
COPY ./dist ${CR_DIST}

RUN ( \
  cd ${CR_HOME} && \
  npm install -g npm@4.x && \
  npm install --production && \
  npm cache clean \
)

CMD ${CR_HOME}/start.sh
