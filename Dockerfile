FROM node:12

ENV USER_DIR /candy-red-user
ENV CANDY_RED_HOME /candy-red

RUN ( \
  mkdir -p ${CANDY_RED_HOME} \
)

COPY ./install.sh ${CANDY_RED_HOME}
COPY ./default-nodes.csv ${CANDY_RED_HOME}
COPY ./package.json ${CANDY_RED_HOME}
COPY ./dist ${CANDY_RED_HOME}/dist

RUN ( \
  cd ${CANDY_RED_HOME} && \
  npm install --production --unsafe-perm \
)

WORKDIR ${CANDY_RED_HOME}
CMD npm run start
