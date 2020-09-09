FROM node:12

ARG CANDY_RED_VERSION
ENV CANDY_RED_VERSION ${CANDY_RED_VERSION:-"latest"}
ENV CANDY_RED_HOME /candy-red-user

RUN ( \
  mkdir -p ${CANDY_RED_HOME} \
)

RUN ( \
  npm install -g --production --unsafe-perm candy-red@${CANDY_RED_VERSION} \
)

WORKDIR ${CANDY_RED_HOME}
CMD npm run --prefix $(npm -g root)/candy-red start
